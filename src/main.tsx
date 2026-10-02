import { render } from 'preact';
import { ruta } from './router';
import { Lista } from './ui/Lista';
import { FichaView } from './ui/FichaView';
import { Imprimir } from './ui/Imprimir';
import { Asistente } from './ui/Asistente';
import './styles.css';

function App() {
  const [, pagina, id, seccion] = ruta.value.replace(/^#/, '').split('/');
  if (pagina === 'ficha' && id) return <FichaView id={id} seccion={seccion || 'principal'} />;
  if (pagina === 'imprimir' && id) return <Imprimir id={id} />;
  if (pagina === 'nueva' && id) return <Asistente id={id} />;
  return <Lista />;
}

render(<App />, document.getElementById('app')!);
