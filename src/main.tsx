import { render } from 'preact';
import { ruta } from './router';
import { Lista } from './ui/Lista';
import { FichaView } from './ui/FichaView';
import './styles.css';

function App() {
  const [, pagina, id, seccion] = ruta.value.replace(/^#/, '').split('/');
  if (pagina === 'ficha' && id) return <FichaView id={id} seccion={seccion || 'principal'} />;
  return <Lista />;
}

render(<App />, document.getElementById('app')!);
