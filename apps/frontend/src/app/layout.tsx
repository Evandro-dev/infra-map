import './globals.css';
import '../features/inventory/catalog.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Infra Map | Infraestrutura Visual',
  description: 'Editor de infraestrutura por escala e setores.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
