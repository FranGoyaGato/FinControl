import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import Income from './Income';
import Expenses from './Expenses';
import CreditCards from './CreditCards';
import ImportData from './ImportData';
import Settings from './Settings';

// Smoke tests: cada página debe montar sin reventar, aunque las llamadas a la
// API (axios contra REACT_APP_BACKEND_URL) fallen en este entorno de test sin
// backend real — todas las páginas ya capturan ese error con try/catch.

test.each([
  ['Dashboard', Dashboard],
  ['Income', Income],
  ['Expenses', Expenses],
  ['CreditCards', CreditCards],
  ['ImportData', ImportData],
  ['Settings', Settings],
])('%s monta sin lanzar ninguna excepción', async (_nombre, Pagina) => {
  render(<Pagina />);
  expect(await screen.findAllByRole('heading')).not.toHaveLength(0);
});
