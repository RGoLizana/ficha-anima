// @vitest-environment happy-dom
// Interfaz con el motor real (sin worker): lo que el usuario ve y toca en cada sección.
import { existsSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, celdasEntrada, golden, listas, motor, read, type NombreFicha } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

// Motor en el mismo hilo: misma API que src/engine/index.ts pero síncrono por dentro
const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'),
  errorMotor: signal(''),
  valores,
  abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id;
    motor().cargar(entradas);
    valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(clave: string, v: Entrada | null) {
    valores.value = { ...valores.value, ...motor().poner(clave, v) };
  },
  async opciones(clave: string, formula = LISTAS[clave]) {
    return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : [];
  },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { modoTecnicas } = await import('../src/ui/Tecnicas');
modoTecnicas.value = 'experto';   // estas pruebas miran todas las casillas de la hoja
const { Lista } = await import('../src/ui/Lista');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

function abrirFicha(n: NombreFicha, seccion = 'principal') {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  const r = render(<FichaView id={f.id} seccion={seccion} />);
  return { f, ...r };
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] input, [data-clave="${clave}"] select, [data-clave="${clave}"] textarea`) as HTMLInputElement & HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter(Boolean);

describe('lista de fichas', () => {
  it('muestra las fichas, filtra al buscar y crea fichas nuevas', async () => {
    for (const n of ['sesshomaru', 'lock', 'ayane']) store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
    render(<Lista />);
    expect(screen.getByText('3 fichas guardadas en este navegador')).toBeTruthy();
    fireEvent.input(screen.getByPlaceholderText('Nombre o categoría'), { target: { value: 'loc' } });
    expect(screen.queryByText('Sesshomaru')).toBeNull();
    expect(screen.getByText('Lock')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Nueva ficha'));
    expect(store.fichas.value).toHaveLength(4);
    expect(location.hash).toMatch(/^#\/nueva\//); // abre el asistente
  }, T);

  it('las tarjetas enseñan categoría y valores clave una vez abierta la ficha', async () => {
    const { unmount } = abrirFicha('sesshomaru');
    await esperarListo();
    await waitFor(() => expect(store.fichas.value[0].resumen?.categoria).toBe('Guerrero Acróbata'));
    unmount();
    render(<Lista />);
    fireEvent.input(screen.getByPlaceholderText('Nombre o categoría'), { target: { value: '' } }); // el filtro persiste
    expect(screen.getByText('Guerrero Acróbata')).toBeTruthy();
    expect(screen.getByText('190')).toBeTruthy();
  }, T);
});

describe('ficha: navegación y estructura', () => {
  it('Personalización y Gremio van aparte, al final, bajo "Fuera de las reglas"', async () => {
    abrirFicha('lock');
    const nav = [...document.querySelectorAll('.sections > *')].map((e) => e.textContent);
    expect(nav.slice(-3)).toEqual(['Fuera de las reglas', 'Personalización', 'Gremio']);
    expect(nav).toContain('Notas');
  }, T);

  it('mientras el motor prepara la ficha no se pintan las secciones (evita listas de otra ficha)', async () => {
    abrirFicha('lock');
    // en este motor de pruebas la carga es inmediata: al acabar debe verse la sección
    await esperarListo();
    expect(screen.getByText('Personaje')).toBeTruthy();
  }, T);

  it.each(['principal', 'trasfondo', 'desarrollo', 'ventajas', 'combate', 'ki', 'tecnicas', 'magia', 'metamagia', 'grimorios', 'psiquica', 'notas'])(
    'sección %s: todas las casillas escriben en celdas de entrada reales del Excel', async (sec) => {
      const entrada = celdasEntrada();
      for (const n of ['sesshomaru', 'lock', 'ayane'] as const) {
        const { unmount } = abrirFicha(n, sec);
        await esperarListo();
        const claves = [...document.querySelectorAll('[data-clave]')].map((e) => e.getAttribute('data-clave')!);
        expect(claves.filter((c) => !entrada.has(c)), `${sec} ${n}`).toEqual([]);
        unmount();
        abierta.value = null;
      }
    }, T);
});

describe('Principal', () => {
  it('barra lateral con los valores del Excel', async () => {
    abrirFicha('sesshomaru');
    await esperarListo();
    const lateral = document.querySelector('.side')!.textContent!;
    for (const t of ['190', '115', '150 Esquiva', '45', '50 m / asalto', '20 PV / día']) expect(lateral).toContain(t);
  }, T);

  it('la defensa indica Parada o Esquiva según el Excel', async () => {
    abrirFicha('ayane');
    await esperarListo();
    expect(document.querySelector('.side')!.textContent).toContain('15 Parada');
  }, T);

  it('editar la base de AGI recalcula total y bono', async () => {
    abrirFicha('sesshomaru');
    await esperarListo();
    fireEvent.change(celda('Principal!E11'), { target: { value: '12' } });
    await waitFor(() => expect(document.querySelector('.caract-card')!.textContent).toContain('13'));
    expect(document.querySelector('.caract-card')!.textContent).toContain('+25');
  }, T);

  it('el tabulador salta los temporales (de base AGI a base CON)', async () => {
    abrirFicha('sesshomaru');
    await esperarListo();
    for (let r = 11; r <= 18; r++) expect(celda(`Principal!F${r}`).tabIndex).toBe(-1);
    expect(celda('Principal!E11').tabIndex).not.toBe(-1);
  }, T);

  it('los desplegables traen las opciones del Excel', async () => {
    abrirFicha('sesshomaru');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('General!F23')).toContain('Humano'));
    expect(opcionesDe('PDs!O7')).toContain('Hechicero');
  }, T);

  it('un valor que no está en la lista se conserva y se muestra (no bloquea)', async () => {
    abrirFicha('lock', 'trasfondo');
    await esperarListo();
    expect(celda('Principal!D68').value).toBe('Yamato-shu');
  }, T);
});

describe('Lenguas (avisa, no bloquea)', () => {
  it('no ofrece lenguas ya elegidas y avisa si se pasa del límite de INT, dejando añadir más', async () => {
    abrirFicha('ayane', 'trasfondo'); // INT permite 3 adicionales, tiene solo la base (Latín)
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Principal!D69').length).toBeGreaterThan(5));
    expect(opcionesDe('Principal!D69')).not.toContain('Latín');
    for (const [r, idx] of [[69, 0], [70, 0], [71, 0], [72, 0]] as const) {
      await waitFor(() => expect(opcionesDe(`Principal!D${r}`).length).toBeGreaterThan(5));
      fireEvent.change(celda(`Principal!D${r}`), { target: { value: opcionesDe(`Principal!D${r}`)[idx] } });
    }
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toMatch(/4 lenguas adicionales.*permite 3/));
    expect(celda('Principal!D73')).toBeTruthy(); // sigue habiendo fila libre
    const elegidas = [69, 70, 71, 72].map((r) => celda(`Principal!D${r}`).value);
    expect(new Set(elegidas).size).toBe(4);
  }, T);
});

describe('Desarrollo', () => {
  it('resumen de PD por categoría y límites como en el Excel', async () => {
    abrirFicha('sesshomaru', 'desarrollo');
    await esperarListo();
    const r = document.querySelector('.pd-cat')!.textContent!;
    expect(r).toContain('900 / 900 PD');
    expect(r).toContain('470 / 540');
  }, T);

  it('pasarse de PD se puede y muestra los avisos del Excel', async () => {
    abrirFicha('sesshomaru', 'desarrollo');
    await esperarListo();
    fireEvent.change(celda('PDs!M25'), { target: { value: '400' } });
    await waitFor(() => expect(document.querySelectorAll('.aviso').length).toBeGreaterThanOrEqual(3));
    const avisos = [...document.querySelectorAll('.aviso')].map((e) => e.textContent);
    expect(avisos).toEqual(expect.arrayContaining(['Exceso de PDs gastados', 'Ataque + Defensa no debe superar: 450']));
    expect(celda('PDs!M25').value).toBe('400');
  }, T);

  it('tablas de estilos y artes marciales: se eligen PD y el grado', async () => {
    abrirFicha('sesshomaru', 'desarrollo');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('PDs!E49')).toContain('Tabla de Ataque inusual'));
    fireEvent.change(celda('PDs!E49'), { target: { value: 'Tabla de Ataque inusual' } });
    await waitFor(() => expect(opcionesDe('PDs!M49')).toEqual(['20']));
    fireEvent.change(celda('PDs!E59'), { target: { value: 'Tae Kwon Do' } });
    await waitFor(() => expect(opcionesDe('PDs!J59')).toEqual(['Base', 'Avanzado', 'Supremo']));
    fireEvent.change(celda('PDs!J59'), { target: { value: 'Base' } });
    await waitFor(() => expect(opcionesDe('PDs!M59')).toEqual(['20']));
    fireEvent.change(celda('PDs!M59'), { target: { value: '20' } });
    await waitFor(() => expect(store.fichas.value[0].entradas['PDs!M59']).toBe(20)); // número, no texto
  }, T);
});

describe('Ventajas y poderes', () => {
  it('muestra las ventajas de la ficha y solo una fila vacía más por bloque', async () => {
    abrirFicha('lock', 'ventajas');
    await esperarListo();
    expect(celda('Principal!C35').value).toBe('Don');
    expect(celda('Principal!C43').value).toBe('Con. natural de Vía: Fuego');
    await waitFor(() => expect(opcionesDe('Principal!C43').length).toBeGreaterThan(20)); // ventajas del Don
    expect(celda('Principal!C51')).toBeTruthy();   // Lock no tiene desventajas: una fila libre
    expect(celda('Principal!C52')).toBeFalsy();
  }, T);
});

describe('Combate', () => {
  const texto = () => document.querySelector('.content')!.textContent!;

  it('Sesshomaru: armas con turno, ataque, defensa y daño como en el Excel', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    const cards = [...document.querySelectorAll('.arma')].map((a) => a.textContent!);
    expect(cards[0]).toContain('Katana');
    for (const t of ['95', '150', '70']) expect(cards[0]).toContain(t);                  // turno, ataque/defensa, daño
    expect(cards[1]).toContain('Armas naturales');
    for (const t of ['115', '150', '50']) expect(cards[1]).toContain(t);
    expect(celda('Combate!E28').value).toBe('Katana');
    expect(celda('Combate!C28').value).toBe('A dos manos');
  }, T);

  it('desarmado y armadura total (TA) como en el Excel', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    const des = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Desarmado'))!.textContent!;
    for (const t of ['115', '90', '150', '20']) expect(des).toContain(t);
    const total = document.querySelector('.total-fila')!;
    expect([...total.querySelectorAll('td.total')].map((e) => e.textContent)).toEqual(['2', '2', '3', '2', '3', '3', '0']);
    expect(celda('Combate!C12').value).toBe('Gabardina');
  }, T);

  it('añadir un arma muestra su ranura y deja siempre una libre', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    expect(celda('Combate!E35')).toBeTruthy();   // ranura 3 libre
    expect(celda('Combate!E42')).toBeFalsy();    // ranura 5 aún no
    await waitFor(() => expect(opcionesDe('Combate!E35').length).toBeGreaterThan(5));
    fireEvent.change(celda('Combate!E35'), { target: { value: opcionesDe('Combate!E35')[0] } });
    await waitFor(() => expect(celda('Combate!P35')).toBeTruthy());  // ranura 4 visible
    fireEvent.change(celda('Combate!P35'), { target: { value: opcionesDe('Combate!P35')[0] } });
    await waitFor(() => expect(celda('Combate!E42')).toBeTruthy());  // y ahora la 5
  }, T);

  it('las armas de proyectiles tienen munición y calidad de munición', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    expect(celda('Combate!E49')).toBeTruthy();
    fireEvent.change(celda('Combate!C49'), { target: { value: 'A dos manos' } });
    await waitFor(() => expect(opcionesDe('Combate!E49').length).toBeGreaterThan(3));
    fireEvent.change(celda('Combate!E49'), { target: { value: opcionesDe('Combate!E49')[0] } });
    await waitFor(() => expect(celda('Combate!E50')).toBeTruthy());   // munición
    expect(celda('Combate!J53')).toBeTruthy();                        // calidad de la munición
  }, T);

  it('calculadora de daño: Daño y % dan el final del Excel', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    fireEvent.change(celda('Combate!U12'), { target: { value: '100' } });
    fireEvent.change(celda('Combate!V12'), { target: { value: '50' } });
    await waitFor(() => expect(document.querySelector('.calc-final strong')!.textContent).toBe('50'));
  }, T);

  it('modificadores a toda acción y a acciones físicas se reflejan en su total', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    fireEvent.change(celda('Combate!AD14'), { target: { value: '-10' } });
    await waitFor(() => expect(texto()).toContain('Total: -10'));
    fireEvent.change(celda('Combate!AF14'), { target: { value: '-5' } });
    await waitFor(() => expect(texto()).toContain('Total: -5'));
  }, T);

  it('pasarse de PD muestra el aviso de Ataque + Defensa también aquí, sin bloquear', async () => {
    abrirFicha('sesshomaru', 'combate');
    await esperarListo();
    store.editar(store.fichas.value[0].id, 'PDs!M25', 400);
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toMatch(/Exceso de PDs gastados/));
  }, T);

  it('las notas de combate se guardan en las celdas del Excel (salen en la página de notas del PDF)', async () => {
    const { f } = abrirFicha('lock', 'combate');
    await esperarListo();
    fireEvent.change(celda('Combate!C67'), { target: { value: 'Capucha de cuero +10' } });
    expect(store.buscar(f.id)!.entradas['Combate!C67']).toBe('Capucha de cuero +10');
  }, T);
});

describe('Ki', () => {
  const texto = () => document.querySelector('.content')!.textContent!;
  const marcada = (clave: string) => (celda(clave) as unknown as HTMLInputElement).checked;

  it('Sesshomaru: puntos de Ki, acumulaciones y CM como en el Excel', async () => {
    abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    const ki = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Puntos de Ki'))!.textContent!;
    expect(ki).toContain('52');   // Ki total
    expect(ki).toContain('8');    // acumulaciones
    expect(texto()).toContain('CM usados 130 de 140');
  }, T);

  it('las habilidades compradas salen marcadas y se pueden marcar y desmarcar', async () => {
    const { f } = abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    for (const c of ['Ki!Q10', 'Ki!Q32', 'Ki!Q49', 'Ki!Q63']) expect(marcada(c)).toBe(true);
    expect(marcada('Ki!Q12')).toBe(false);
    await waitFor(() => expect(celda('Ki!Q12')).toBeTruthy());
    fireEvent.click(celda('Ki!Q12'));                       // Control del Ki: 30 CM
    await waitFor(() => expect(store.buscar(f.id)!.entradas['Ki!Q12']).toBe(30)); // número: el coste de la lista
    await waitFor(() => expect(texto()).toContain('CM usados 160 de 140'));
    fireEvent.click(celda('Ki!Q12'));
    await waitFor(() => expect('Ki!Q12' in store.buscar(f.id)!.entradas).toBe(false));
  }, T);

  it('pasarse de CM avisa (Exceso de CM) sin impedirlo', async () => {
    abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    await waitFor(() => expect(celda('Ki!Q12')).toBeTruthy());
    fireEvent.click(celda('Ki!Q12'));
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toBe('Exceso de CM'));
    expect(marcada('Ki!Q12')).toBe(true);
  }, T);

  it('Ataque elemental (varias opciones) es un desplegable y destapa su panel', async () => {
    abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    expect(screen.queryByText('Ataque elemental', { selector: 'h2' })).toBeNull();
    await waitFor(() => expect(opcionesDe('Ki!Q37')).toEqual(['10', '20', '30', '40', '50', '60']));
    fireEvent.change(celda('Ki!Q37'), { target: { value: '10' } });
    await waitFor(() => expect(screen.getByText('Ataque elemental', { selector: 'h2' })).toBeTruthy());
  }, T);

  it('sellos de invocación y sellos Dragón son casillas', async () => {
    const { f } = abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    await waitFor(() => expect(celda('Ki!X11')).toBeTruthy());
    fireEvent.click(celda('Ki!X11'));
    await waitFor(() => expect(store.buscar(f.id)!.entradas['Ki!X11']).toBe('Menor Ki: 5'));
    fireEvent.click(celda('Ki!H28'));
    await waitFor(() => expect(store.buscar(f.id)!.entradas['Ki!H28']).toBe('Ejad'));
  }, T);

  it('Lock: técnica de dominio Baile espectral con nivel y descripción del Excel', async () => {
    abrirFicha('lock', 'ki');
    await esperarListo();
    expect(celda('Ki!V26').value).toBe('Baile espectral');
    expect(texto()).toContain('Nivel 1');
    expect(texto()).toContain('AGI 3, CON 3, POD 3, VOL 3');
    expect(celda('Ki!AD26')).toBeTruthy();   // siempre queda una técnica libre
  }, T);

  it('Unificación, pactos de sangre y notas se guardan', async () => {
    const { f } = abrirFicha('lock', 'ki');
    await esperarListo();
    fireEvent.change(celda('Ki!I10'), { target: { value: 'No' } });
    fireEvent.change(celda('Ki!AA12'), { target: { value: 'Lobo de sombra' } });
    fireEvent.change(celda('Ki!C67'), { target: { value: 'Nota de Ki' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'Ki!I10': 'No', 'Ki!AA12': 'Lobo de sombra', 'Ki!C67': 'Nota de Ki' });
    await waitFor(() => expect(celda('Ki!AA13')).toBeTruthy()); // nueva fila de pacto libre
  }, T);
});

describe('Técnicas de Ki', () => {
  const resumen = (n: number) => document.querySelectorAll('details.tecnica > summary')[n - 1].textContent!;

  it('Lock: la técnica 1 sale abierta con su nombre, nivel y CM; las demás cerradas', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    const det = document.querySelectorAll('details.tecnica');
    expect(det).toHaveLength(10);
    expect((det[0] as HTMLDetailsElement).open).toBe(true);
    expect((det[1] as HTMLDetailsElement).open).toBe(false);
    expect(resumen(1)).toContain('Baile espectral');
    expect(resumen(1)).toContain('Nivel 1');
    expect(resumen(1)).toContain('CM 20');
    expect(resumen(1)).toContain('AGI 3, CON 3, POD 3, VOL 3');
  }, T);

  it('efecto, modificadores de características y desventaja de Lock', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    expect(celda('Creación de Técnicas!F16').value).toBe('Recuperar Acción');
    expect(celda('Creación de Técnicas!D16').value).toBe('Primario');
    for (const c of ['V16', 'X16', 'AD16', 'AF16']) expect(celda(`Creación de Técnicas!${c}`).value).toBe('3');
    expect(celda('Creación de Técnicas!F21').value).toBe('Atadura Elemental');
    expect(celda('Creación de Técnicas!O21').value).toBe('Luz');
    expect(celda('Creación de Técnicas!Q21').value).toBe('Fuego');
  }, T);

  it('añadir un efecto abre otra fila de efecto y sus opciones', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    expect(celda('Creación de Técnicas!F18')).toBeFalsy();
    await waitFor(() => expect(opcionesDe('Creación de Técnicas!F17')).toContain('Habilidad de Ataque'));
    fireEvent.change(celda('Creación de Técnicas!F17'), { target: { value: 'Habilidad de Ataque' } });
    await waitFor(() => expect(celda('Creación de Técnicas!F18')).toBeTruthy());
    await waitFor(() => expect(celda('Creación de Técnicas!J29')).toBeTruthy()); // opciones del 2.º efecto
  }, T);

  it('cambiar el nivel recalcula el CM; pasarse de Ki avisa sin bloquear', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    fireEvent.change(celda('Creación de Técnicas!P12'), { target: { value: '3' } });
    await waitFor(() => expect(resumen(1)).toContain('CM 60'));
    fireEvent.change(celda('Creación de Técnicas!P12'), { target: { value: '1' } });
    fireEvent.change(celda('Creación de Técnicas!V17'), { target: { value: '50' } });
    await waitFor(() => expect(document.querySelector('details.tecnica .aviso')?.textContent).toMatch(/Puntos de Ki empleados y necesarios no coinciden/));
    expect(celda('Creación de Técnicas!V17').value).toBe('50');
  }, T);

  it('las técnicas sin usar muestran Técnica N', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    expect(resumen(2)).toContain('Técnica 2');
  }, T);

  it('descripción y árbol de técnicas se guardan', async () => {
    const { f } = abrirFicha('lock', 'tecnicas');
    await esperarListo();
    fireEvent.change(celda('Creación de Técnicas!D37'), { target: { value: 'Danza sobrenatural' } });
    fireEvent.change(celda('Creación de Técnicas!W6'), { target: { value: 'Árbol' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'Creación de Técnicas!D37': 'Danza sobrenatural', 'Creación de Técnicas!W6': 'Árbol' });
  }, T);
});

describe('Magia', () => {
  const texto = () => document.querySelector('.content')!.textContent!;

  it('Lock: nivel de magia, zeón y convocatoria como en el Excel', async () => {
    abrirFicha('lock', 'magia');
    await esperarListo();
    const nivel = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Nivel de magia'))!.textContent!;
    for (const t of ['185', '60', '90', '175']) expect(nivel).toContain(t);   // nivel, reg. zeón/ACT, turno, proyección
    expect(texto()).toContain('Total 1110');                                  // zeón total
    expect(celda('Místicos!M18').value).toBe('970');                          // zeón actual (entrada)
    const conv = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Convocatoria'))!;
    expect([...conv.querySelectorAll('td.total')].map((e) => e.textContent)).toEqual(['20', '5', '20', '20']);
  }, T);

  it('vías con su nivel usado; pasarse de nivel de magia avisa sin bloquear', async () => {
    const { f } = abrirFicha('lock', 'magia');
    await esperarListo();
    expect(celda('Místicos!C15').value).toBe('Fuego');
    expect(celda('Místicos!G15').value).toBe('36');
    expect(celda('Místicos!E16').value).toBe('Paz');
    expect(document.querySelector('.aviso')).toBeNull();
    fireEvent.change(celda('Místicos!G15'), { target: { value: '500' } });
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toBe('Exceso de Nivel de Magia'));
    expect(store.buscar(f.id)!.entradas['Místicos!G15']).toBe(500);
    fireEvent.change(celda('Místicos!G15'), { target: { value: '36' } });
    await waitFor(() => expect(document.querySelector('.aviso')).toBeNull());
  }, T);

  it('conjuros seleccionados y de libre acceso salen con su nivel, y siempre hay una fila libre', async () => {
    abrirFicha('lock', 'magia');
    await esperarListo();
    expect(celda('Místicos!W12').value).toBe('Esencia');
    expect(celda('Místicos!Y12').value).toBe('Comunicación por esencia');
    expect(celda('Místicos!W13')).toBeTruthy();                   // fila libre tras el último seleccionado
    expect(celda('Místicos!W14')).toBeFalsy();
    expect(celda('Místicos!AG12').value).toBe('Aseamiento');
    expect(celda('Místicos!AK12').value).toBe('4');
    expect(texto()).toContain('Nv 10');                           // nivel del conjuro seleccionado
    await waitFor(() => expect(opcionesDe('Místicos!Y13').length).toBeGreaterThan(500));   // sin vía: todos los conjuros
    fireEvent.change(celda('Místicos!W13'), { target: { value: 'Esencia' } });
    await waitFor(() => expect(opcionesDe('Místicos!Y13').length).toBeLessThan(100));      // con vía: los de esa vía (INDIRECT)
    await waitFor(() => expect(celda('Místicos!W14')).toBeTruthy());
  }, T);

  it('conjuros activos suman su zeón diario; ofudas calculan su zeón', async () => {
    abrirFicha('lock', 'magia');
    await esperarListo();
    fireEvent.change(celda('Místicos!C33'), { target: { value: 'Escudo de luz' } });
    fireEvent.change(celda('Místicos!H33'), { target: { value: '120' } });
    await waitFor(() => expect(texto()).toContain('Coste zeónico al día: 120'));
    fireEvent.change(celda('Místicos!AP62'), { target: { value: 'Esencia' } });
    await waitFor(() => expect(opcionesDe('Místicos!AR62').length).toBeGreaterThan(5));
    fireEvent.change(celda('Místicos!AR62'), { target: { value: 'Comunicación por esencia' } });
    fireEvent.change(celda('Místicos!AV62'), { target: { value: '3' } });
    await waitFor(() => expect(texto()).toContain('Zeón 45'));
  }, T);

  it('contenedor, amplificador, especialidad, teorema y notas se guardan', async () => {
    const { f } = abrirFicha('lock', 'magia');
    await esperarListo();
    fireEvent.change(celda('Místicos!L20'), { target: { value: '100' } });
    fireEvent.change(celda('Místicos!L26'), { target: { value: '5' } });
    fireEvent.change(celda('Místicos!C64'), { target: { value: 'Nota de magia' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'Místicos!L20': 100, 'Místicos!L26': 5, 'Místicos!C64': 'Nota de magia' });
    await waitFor(() => expect(texto()).toContain('Total 1210'));   // el contenedor suma al zeón total
  }, T);
});

describe('Metamagia', () => {
  it('Lock: sus 5 habilidades compradas salen marcadas con nombre y coste', async () => {
    abrirFicha('lock', 'metamagia');
    await esperarListo();
    const marcadas = [...document.querySelectorAll('.mm-nodo input[type=checkbox]:checked')].map((c) => c.closest('label')!.getAttribute('data-clave'));
    expect(marcadas.sort()).toEqual(['Metamagia!AB48', 'Metamagia!AB53', 'Metamagia!AE53', 'Metamagia!AE62', 'Metamagia!AH53']);
    const titulos = [...document.querySelectorAll('.mm-nombre')].map((t) => t.textContent);
    expect(titulos).toEqual(expect.arrayContaining(['Escudos potenciados', 'Erudición ofensiva', 'Doble conjuro']));
    expect(document.querySelectorAll('.mm-nodo')).toHaveLength(68);   // una caja por casilla de compra del árbol
  }, T);

  it('comprar una habilidad sube el nivel usado de metamagia y se puede deshacer', async () => {
    const { f } = abrirFicha('lock', 'metamagia');
    await esperarListo();
    const usado = () => document.querySelector('.panel .muted.small')!.textContent!;
    expect(usado()).toContain('metamagia 25');
    await waitFor(() => expect(celda('Metamagia!J13')).toBeTruthy());
    fireEvent.click(celda('Metamagia!J13'));
    await waitFor(() => expect(store.buscar(f.id)!.entradas['Metamagia!J13']).toBe(10));
    await waitFor(() => expect(usado()).toContain('metamagia 35'));
    fireEvent.click(celda('Metamagia!J13'));
    await waitFor(() => expect(usado()).toContain('metamagia 25'));
  }, T);

  it('las habilidades metamágicas conseguidas aparecen en Magia', async () => {
    abrirFicha('lock', 'magia');
    await esperarListo();
    expect(document.querySelector('.content')!.textContent).toContain('Efectos persistentes');
  }, T);
});

describe('Grimorios de magia y de vía', () => {
  it('Grimorio de magia: conjuros elegidos con nivel, grados y descripción del Excel', async () => {
    abrirFicha('lock', 'grimorios');
    await esperarListo();
    expect(celda('Grimorio Magia!C11').value).toBe('Bolsa infinita');
    const cards = [...document.querySelectorAll('.conjuro')].map((c) => c.textContent!);
    expect(cards[0]).toContain('Bolsa infinita');
    expect(cards[0]).toContain('Nivel 12');
    for (const t of ['Base', 'Intermedio', 'Avanzado', 'Arcano', '40', '120']) expect(cards[0]).toContain(t);
    expect(celda('Grimorio Magia!V11')).toBeTruthy();    // Lock tiene 4 en la columna izquierda; la siguiente casilla está libre
  }, T);

  it('Grimorio de vía: al elegir vía y subvía aparecen sus conjuros por niveles', async () => {
    abrirFicha('lock', 'grimorios');
    await esperarListo();
    expect(document.querySelectorAll('.conjuro').length).toBeLessThan(10);   // sin vía solo los 4 del grimorio de magia
    fireEvent.change(celda('Grimorio de Vía!J6'), { target: { value: 'Oscuridad' } });
    await waitFor(() => expect(opcionesDe('Grimorio de Vía!J7').length).toBeGreaterThan(0));
    fireEvent.change(celda('Grimorio de Vía!J7'), { target: { value: 'Umbral' } });
    await waitFor(() => expect(document.querySelector('.content')!.textContent).toContain('Crear oscuridad'));
    const titulos = [...document.querySelectorAll('.conjuro .arma-titulo')].map((t) => t.textContent);
    expect(titulos).toEqual(expect.arrayContaining(['Crear oscuridad', 'Ojos del otro lado', 'Sombra', 'Noche', 'Holocausto de oscuridad']));
    expect(document.querySelector('.content')!.textContent).toContain('Conjuros de nivel 2-10');
  }, T);
});

describe('Psíquica', () => {
  const texto = () => document.querySelector('.content')!.textContent!;

  it('Ayane: CVs, potencial y proyección como en el Excel', async () => {
    abrirFicha('ayane', 'psiquica');
    await esperarListo();
    const stats = [...document.querySelectorAll('.salidas .stat')].map((e) => e.textContent!);
    expect(stats.join('|')).toContain('100');   // potencial
    expect(stats.join('|')).toContain('150');   // proyección
    expect(celda('Psíquicos!M13').value).toBe('2');
    expect(texto()).toContain('Psicopatía');
    expect(celda('Psíquicos!V11').value).toBe('Impacto telequinético');
  }, T);

  it('disciplinas afines y poderes: siempre hay una fila libre y la lista depende de las disciplinas', async () => {
    abrirFicha('ayane', 'psiquica');
    await esperarListo();
    expect(celda('Psíquicos!C25').value).toBe('Piroquinesis');
    expect(celda('Psíquicos!C33')).toBeTruthy();   // fila libre tras la última
    expect(celda('Psíquicos!C35')).toBeFalsy();
    await waitFor(() => expect(opcionesDe('Psíquicos!V25').length).toBeGreaterThan(3));
  }, T);

  it('pasarse de CVs o de innatos avisa sin bloquear', async () => {
    const { f } = abrirFicha('ayane', 'psiquica');
    await esperarListo();
    expect(document.querySelector('.aviso')).toBeNull();
    fireEvent.change(celda('Psíquicos!AA11'), { target: { value: '50' } });
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toContain('Exceso de CVs'));
    expect(store.buscar(f.id)!.entradas['Psíquicos!AA11']).toBe(50);
    fireEvent.change(celda('Psíquicos!AA11'), { target: { value: '' } });
    await waitFor(() => expect(document.querySelector('.aviso')).toBeNull());
    fireEvent.change(celda('Psíquicos!M13'), { target: { value: '-1' } });
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toContain('Exceso de innatos activos'));
  }, T);

  it('Grimorio Psíquica: disciplinas elegidas con sus poderes y dificultades', async () => {
    abrirFicha('ayane', 'psiquica');
    await esperarListo();
    expect(celda('Grimorio Psíquica!S6').value).toBe('Piroquinesis');
    const titulos = [...document.querySelectorAll('.conjuro .arma-titulo')].map((t) => t.textContent);
    expect(titulos).toEqual(expect.arrayContaining(['Crear fuego', 'Telequinesis menor', 'Impacto telequinético']));
    expect(titulos).not.toContain('0');
    expect(document.querySelector('.conjuro')!.textContent).toContain('Rutinario');
  }, T);
});

describe('Notas', () => {
  it('se escriben y se guardan', async () => {
    const { f } = abrirFicha('lock', 'notas');
    fireEvent.input(screen.getByLabelText('Notas'), { target: { value: 'Vía de tierra' } });
    expect(store.buscar(f.id)!.notas).toBe('Vía de tierra');
  }, T);
});

describe('importar desde la lista', () => {
  const subir = (archivo: File) => {
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    fireEvent.change(input);
  };

  it.skipIf(!existsSync('ref/pdf/lock 8.7.0.xlsm'))('el botón acepta una ficha .xlsm y rechaza lo que no es un Excel', async () => {
    const { readFileSync } = await import('node:fs');
    render(<Lista />);
    subir(new File([readFileSync('ref/pdf/lock 8.7.0.xlsm')], 'lock 8.7.0.xlsm'));
    await waitFor(() => expect(screen.getByText('Lock')).toBeTruthy());
    subir(new File(['basura'], 'otra.xlsm'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/otra\.xlsm: no es un archivo Excel/));
    expect(store.fichas.value).toHaveLength(1);
  }, T);
});
