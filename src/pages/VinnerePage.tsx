import { publicUrl } from '../config';

export function VinnerePage() {
  return (
    <iframe
      className="vinnere-frame"
      title="Slik løp de beste"
      src={publicUrl('vinnere/index.html')}
    />
  );
}
