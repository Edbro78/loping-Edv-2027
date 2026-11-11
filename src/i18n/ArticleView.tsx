import { AdSlot } from '../components/AdSlot';
import { HomeToolLink } from '../components/HomeToolLink';
import type { ArticleDoc } from './types';

type Props = {
  doc: ArticleDoc;
};

export function ArticleView({ doc }: Props) {
  return (
    <article className="about wrap">
      <div className="about-in">
        <p className="kicker ink">{doc.kicker}</p>
        <h1>{doc.h1}</h1>
        <p className="lead">{doc.lead}</p>
        {doc.homeToolLink && <HomeToolLink to={doc.homeToolTo}>{doc.homeToolLink}</HomeToolLink>}
        {doc.blocks.map((block, i) => {
          if (block.type === 'h2') return <h2 key={i}>{block.text}</h2>;
          if (block.type === 'pull') return <p className="pull" key={i}>{block.text}</p>;
          if (block.type === 'help') return <p className="help" key={i}>{block.text}</p>;
          return <p key={i}>{block.text}</p>;
        })}
        {doc.adSlots?.map((slot) => (
          <AdSlot key={slot} slot={slot} />
        ))}
      </div>
    </article>
  );
}
