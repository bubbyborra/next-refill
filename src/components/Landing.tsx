// The start page below the first screen: what a Jan Aushadhi price is, why people miss it,
// how it works, how it matches medicines, questions, and the footer. Static, so it renders on
// the server. Every number here comes from the fact sheet in the project notes.
import type { ReactNode } from "react";
import { PRODUCT } from "@/lib/brand";
import { Mark, WindowBar } from "./Parts";

export function Sections() {
  return (
    <>
      <WhatIsJanAushadhi />
      <WhyPeopleMissIt />
      <HowItWorks />
      <HowItMatches />
      <Questions />
    </>
  );
}

// Era's section label: a coloured block at the far left that runs out to the page edge.
function Label({ children, alt = false }: { children: ReactNode; alt?: boolean }) {
  return (
    <p className="nr-sec__label" data-tone={alt ? "alt" : "main"}>
      <span>{children}</span>
    </p>
  );
}

function WhatIsJanAushadhi() {
  return (
    <section id="jan-aushadhi" className="nr-sec" aria-labelledby="jan-aushadhi-h">
      <Label>Generic medicines</Label>
      <div className="nr-sec__body">
        <h2 id="jan-aushadhi-h" className="nr-sec__h">
          What is a Jan Aushadhi price?
        </h2>
        <p className="nr-sec__lead">
          Jan Aushadhi Kendras are medicine stores run under a government scheme, Pradhan Mantri Bhartiya Janaushadhi
          Pariyojana. They sell generic medicines: the same salt, in the same strength, sold under the medicine&apos;s own name
          instead of a brand name. The Jan Aushadhi price is the MRP on the scheme&apos;s official product list.
        </p>
        <div className="nr-ja">
          <figure className="nr-ja__win">
            <WindowBar />
            <div className="nr-ja__body">
              <div className="nr-ja__brand">
                <p className="nr-ja__name">
                  Telma 40 <span className="nr-ja__tag">(brand)</span>
                </p>
                <p className="nr-ja__text">contains Telmisartan 40 mg.</p>
              </div>
              <svg className="nr-ja__arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <div className="nr-ja__card">
                <p className="nr-ja__small">At Jan Aushadhi:</p>
                <p className="nr-ja__generic">Telmisartan Tablets IP 40mg</p>
                <p className="nr-ja__code">drug code 300</p>
                <p className="nr-ja__price">
                  ₹12.38 <span>for 10 tablets</span>
                </p>
              </div>
            </div>
            <figcaption className="nr-ja__src">Official PMBI product list, read 20 Nov 2026.</figcaption>
          </figure>
          <dl className="nr-facts">
            <div className="nr-fact">
              <dt>50–80% lower</dt>
              <dd>the government&apos;s estimate for Jan Aushadhi prices against comparable brands (PIB, March 2026)</dd>
            </div>
            <div className="nr-fact">
              <dt>More than 18,000</dt>
              <dd>stores in India (PIB, March 2026); 528 in Bengaluru Urban (Locate Kendra list)</dd>
            </div>
            <div className="nr-fact">
              <dt>2,453</dt>
              <dd>products on the official list (PMBI, read 20 Nov 2026)</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function WhyPeopleMissIt() {
  return (
    <section id="why" className="nr-sec" aria-labelledby="why-h">
      <Label alt>The brand name</Label>
      <div className="nr-sec__body">
        <h2 id="why-h" className="nr-sec__h">
          Why people miss it
        </h2>
        <p className="nr-sec__lead">
          The brand name is printed big on the strip. The salt inside is in small English print on the back. So people ask for
          the brand and pay the brand&apos;s price. A nine-state study found use is held back mainly by low awareness, worries
          about stock, and doctors writing brand names (BMJ Open, 2026).
        </p>
        <figure className="nr-strips">
          <div
            className="nr-strips__pair"
            role="img"
            aria-label="Illustration: Telma 40 printed big on the front of a strip, and Telmisartan 40 mg in small print on the back"
          >
            <div className="nr-foil nr-foil--front">
              <p className="nr-foil__brand">Telma 40</p>
              <div className="nr-foil__pills">
                {Array.from({ length: 5 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </div>
            <div className="nr-foil nr-foil--back">
              <i className="nr-foil__line" style={{ width: "72%" }} />
              <i className="nr-foil__line" style={{ width: "46%" }} />
              <p className="nr-foil__salt">Telmisartan 40 mg</p>
              <i className="nr-foil__line" style={{ width: "84%" }} />
              <i className="nr-foil__line" style={{ width: "58%" }} />
              <i className="nr-foil__line" style={{ width: "66%" }} />
            </div>
          </div>
          <figcaption className="nr-strips__cap">Illustration</figcaption>
        </figure>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Say it, or show it",
    text: "Say the name on the strip, how many a day and the price, in your language. Or hold the strip up to the camera.",
  },
  {
    title: "It checks the official list",
    text: "It looks for the same salt, strength, form and type (plain, SR, gastro-resistant) on the government's list. Nothing else counts as a match.",
  },
  {
    title: "Hear the saving",
    text: "It tells you the Jan Aushadhi price per month, what you save, and the nearest store.",
  },
  {
    title: "Get it on your phone",
    text: "Scan a QR code: the medicine name and drug code to show the pharmacist, directions, monthly refill reminders and a voice note in your language.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="nr-sec" aria-labelledby="how-it-works-h">
      <Label>In your language</Label>
      <div className="nr-sec__body">
        <h2 id="how-it-works-h" className="nr-sec__h">
          How it works
        </h2>
        <ol className="nr-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="nr-step">
              <span className="nr-step__n" aria-hidden>
                {i + 1}
              </span>
              <h3 className="nr-step__t">{s.title}</h3>
              <p className="nr-step__d">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HowItMatches() {
  return (
    <section id="how" className="nr-sec nr-how">
      <Label alt>How it matches medicines</Label>
      <div className="nr-how__cols">
        <div className="nr-how__col">
          <h3 className="nr-how__title">Same medicine only</h3>
          <p className="nr-how__text">
            A match needs the same ingredients, strength, form and release type (SR, gastro-resistant…) as your strip. It never
            suggests a different medicine, strength or dose.
          </p>
        </div>
        <div className="nr-how__col">
          <h3 className="nr-how__title">Government data</h3>
          <p className="nr-how__text">
            Prices come from PMBI&apos;s Jan Aushadhi product list, and stores from its Locate Kendra list (528 stores in
            Bengaluru Urban).
          </p>
        </div>
        <div className="nr-how__col">
          <h3 className="nr-how__title">Not medical advice</h3>
          <p className="nr-how__text">
            Show the list to your pharmacist, and ask your doctor if you have any doubt. It doesn&apos;t sell medicines or keep
            your phone number.
          </p>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = [
  {
    q: "Is the generic really the same medicine?",
    a: "It matches only the same salt, strength, form and release type that the official list shows. Show the list to your pharmacist, and ask your doctor if you have any doubt.",
  },
  {
    q: "Does it cost anything?",
    a: "No. No sign-up and no phone number. The list reaches your phone through a QR code.",
  },
  {
    q: "Where do the prices come from?",
    a: "Jan Aushadhi prices come from PMBI's official product list, and stores from its Locate Kendra list, both read on 20 Nov 2026. Your brand's price is the one you say, or the one on the strip.",
  },
  {
    q: "Which cities?",
    a: "The store search covers Bengaluru Urban for now. The price check works for any medicine on the national list.",
  },
];

function Questions() {
  return (
    <section id="questions" className="nr-sec">
      <Label>Questions</Label>
      <dl className="nr-faq">
        {QUESTIONS.map((f) => (
          <div key={f.q} className="nr-faq__row">
            <dt className="nr-faq__q">{f.q}</dt>
            <dd className="nr-faq__a">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="nr-foot">
      <div className="nr-foot__inner">
        <p className="nr-foot__fine">
          Not medical advice. {PRODUCT.name} is an independent project. It is not run by PMBI or the Government of India. Jan
          Aushadhi helpline: <a href="tel:18001808080">1800-180-8080</a>. Voice by Agora Conversational AI and Murf Falcon.
        </p>
        <nav className="nr-foot__links" aria-label="Footer">
          <ul>
            <li>
              <a href="#top">Start a call</a>
            </li>
            <li>
              <a href="#jan-aushadhi">What is Jan Aushadhi?</a>
            </li>
            <li>
              <a href="#how">How it matches</a>
            </li>
          </ul>
          <ul>
            <li>
              <a href="https://github.com/bubbyborra/next-refill" target="_blank" rel="noreferrer">
                Source code
              </a>
            </li>
            <li>
              <a href="https://janaushadhi.gov.in" target="_blank" rel="noreferrer">
                Official data
              </a>
            </li>
          </ul>
        </nav>
        <div className="nr-foot__brand">
          <Mark />
          <span className="nr-foot__name">{PRODUCT.name}</span>
          <span className="nr-foot__tag">{PRODUCT.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
