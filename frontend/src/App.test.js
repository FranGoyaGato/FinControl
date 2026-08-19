import { render, screen } from '@testing-library/react';
import App from './App';

test('la app carga y muestra el dashboard por defecto', async () => {
  render(<App />);
  expect(await screen.findByText(/dashboard/i)).toBeInTheDocument();
});
