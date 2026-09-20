import authEntryBackground from "../../mobile/assets/backgrounds/auth-entry-bg.png";
import specimenBiologicalBackground from "../../mobile/assets/backgrounds/specimen-biological-bg.png";
import { SeekerZeroHero } from "./SeekerZeroHero";

export default function Home() {
  return (
    <div className="siteRoot">
      <div className="atmosphere" aria-hidden="true">
        <img
          className="atmosphereImage atmosphereSpecimen"
          src={specimenBiologicalBackground.src}
          alt=""
          decoding="async"
        />
        <img
          className="atmosphereImage atmosphereAuth"
          src={authEntryBackground.src}
          alt=""
          decoding="async"
        />
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
            <li>RELEASE</li>
            <li>ACCEPT</li>
            <li>BIRTH</li>
          </ol>
          <p className="mutation">RELATED TO ITS PARENT. NEVER IDENTICAL.</p>
        </section>

        <section className="originPanel" aria-labelledby="lineage-title">
          <div className="originStatement">
            <p className="sectionMark">ORIGIN</p>
            <h2 id="lineage-title">EVERY ORGANISM DESCENDS FROM SEEKER ZERO.</h2>
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
