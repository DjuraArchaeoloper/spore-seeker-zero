import {
  SEEKER_ZERO_CREATURE_WEB_ASSETS,
  SPORE_WEB_BACKGROUNDS
} from "@spore/shared/web-assets";
import { SeekerZeroHero } from "./SeekerZeroHero";

const sporeSeed = SEEKER_ZERO_CREATURE_WEB_ASSETS.layers.core;

export default function Home() {
  return (
    <div className="siteRoot">
      <div className="atmosphere" aria-hidden="true">
        <picture className="atmospherePicture">
          <source
            media="(max-width: 900px) and (orientation: portrait)"
            srcSet={SPORE_WEB_BACKGROUNDS.mobile.src}
          />
          <source media="(max-width: 760px)" srcSet={SPORE_WEB_BACKGROUNDS.mobile.src} />
          <img
            className="atmosphereImage"
            src={SPORE_WEB_BACKGROUNDS.desktop.src}
            alt=""
            decoding="async"
            height={SPORE_WEB_BACKGROUNDS.desktop.height}
            width={SPORE_WEB_BACKGROUNDS.desktop.width}
          />
        </picture>
        <div className="atmosphereVeil" />
      </div>

      <header className="masthead" aria-label="SPØR">
        <span>SPØR</span>
        <i aria-hidden="true" />
        <span>SEEKER ZERO</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="heroCopy">
            <p className="heroKicker">SEEKER ZERO</p>
            <h1 id="hero-title">SPØR</h1>
            <p className="origin">IT STARTED WITH SEEKER ZERO.</p>
            <p className="heroText">
              A digital species spreading from one Solana Seeker to another.
            </p>
          </div>

          <SeekerZeroHero />
        </section>

        <section className="spread" aria-labelledby="spread-title">
          <p className="sectionMark" id="spread-title">HOW LIFE SPREADS</p>
          <ol className="lifeSequence" aria-label="Release, accept, birth">
            {["RELEASE", "ACCEPT", "BIRTH"].map((step) => (
              <li key={step}>
                <span>{step}</span>
                <img
                  className="sequenceSeed"
                  src={sporeSeed.src}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  height={sporeSeed.height}
                  width={sporeSeed.width}
                />
              </li>
            ))}
          </ol>
          <p className="mutation">
            <span>RELATED TO ITS PARENT.</span>
            <span>NEVER IDENTICAL.</span>
          </p>
        </section>

        <section className="originPanel" aria-labelledby="lineage-title">
          <div className="originStatement">
            <p className="sectionMark">ORIGIN</p>
            <h2 id="lineage-title">
              <span>EVERY ORGANISM</span>
              <span>DESCENDS FROM</span>
              <span>SEEKER ZERO.</span>
            </h2>
            <p>Each birth adds another branch to a permanent bloodline.</p>
          </div>
          <div className="lawStatement" aria-label="SPØR technology">
            <p>THE LAWS OF THE SPECIES LIVE ON SOLANA.</p>
            <span>BUILT FOR SOLANA SEEKER.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
