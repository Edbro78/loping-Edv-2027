import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  children: ReactNode;
  to?: string;
};

/** Lenke til et verktøy – brukes på artikkelsider uten duplisert UI. */
export function HomeToolLink({ children, to = '/' }: Props) {
  return (
    <p className="about-tool-link">
      <Link to={to}>{children}</Link>
    </p>
  );
}
