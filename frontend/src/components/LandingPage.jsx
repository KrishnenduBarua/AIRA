import { useLanguage } from "../i18n";

// The exact demo URL was not present in the repository, so this keeps the
// YouTube destination in one place until the final video URL is supplied.
const DEMO_VIDEO_URL =
  "https://www.youtube.com/results?search_query=Finoly+CUET_R2S4+Project+Demo";

const CONTENT = {
  en: {
    nav: {
      how: "How it works",
      features: "Why AIRA",
      team: "Our team",
      faq: "FAQ",
      enter: "Enter AIRA",
    },
    hero: {
      eyebrow: "Alternative credit intelligence",
      title: "A clearer path to trusted credit.",
      body: "AIRA helps financially active people turn everyday financial behaviour into a private, understandable trust profile — so good records can open better opportunities.",
      primary: "Start with AIRA",
      secondary: "Watch the walkthrough",
      note: "Consent-first · Built for Bangladesh",
    },
    visual: {
      label: "Personal trust profile",
      score: "78",
      scoreLabel: "Trust signal",
      verified: "Identity verified",
      income: "Income consistency",
      activity: "Account activity",
      portable: "Portable profile",
      updated: "Updated just now",
    },
    signal: {
      eyebrow: "Why this matters",
      title: "Your financial life already tells a story.",
      body: "Traditional credit can miss people who earn, save, and transact every day. AIRA makes those signals easier to understand and share on your terms.",
      stats: [
        ["01", "Everyday data", "See the patterns behind your financial activity."],
        ["02", "Human clarity", "Understand what strengthens your profile."],
        ["03", "More opportunity", "Share a stronger picture with lending partners."],
      ],
    },
    how: {
      eyebrow: "How AIRA works",
      title: "Simple steps. Meaningful signals.",
      cards: [
        ["01", "Create your profile", "Verify your identity and set up your private AIRA account."],
        ["02", "Connect your record", "Upload a statement you choose, with clear consent at every step."],
        ["03", "See your trust profile", "Get an understandable view of the habits lenders look for."],
      ],
    },
    features: {
      eyebrow: "Designed around trust",
      title: "Useful for people. Clear for lenders.",
      body: "AIRA gives both sides a more transparent starting point, without turning a person into a single unexplained number.",
      items: [
        ["01", "Private by design", "You decide what is shared, with whom, and when."],
        ["02", "Explainable insights", "Every signal is translated into plain, practical language."],
        ["03", "Responsible decisions", "AIRA supports review — it never makes a loan decision for a human."],
      ],
    },
    demo: {
      eyebrow: "See AIRA in action",
      title: "A short look at the experience.",
      body: "See how AIRA turns everyday records into a clearer financial conversation.",
      button: "Open the YouTube demo",
      caption: "AIRA product walkthrough",
    },
    team: {
      eyebrow: "The people behind AIRA",
      title: "Built with care and curiosity.",
      body: "Our five-member team is working to make financial opportunity easier to reach and easier to understand.",
      photo: "Photo coming soon",
    },
    faq: {
      eyebrow: "Questions, answered",
      title: "A thoughtful place to start.",
      items: [
        ["Is AIRA a lender?", "No. AIRA creates an explainable trust profile. Lending organisations make their own decisions."],
        ["What data does AIRA use?", "Only the information you choose to provide, such as identity details and a mobile-money or bank statement."],
        ["Can I control what is shared?", "Yes. Consent is explicit, and you can withdraw it from your dashboard."],
      ],
    },
    footer: {
      line: "Trust should be understandable.",
      enter: "Go to the AIRA portal",
      rights: "AIRA · Alternative Credit Intelligence",
    },
  },
  bn: {
    nav: {
      how: "কীভাবে কাজ করে",
      features: "কেন AIRA",
      team: "আমাদের দল",
      faq: "জিজ্ঞাসা",
      enter: "AIRA-তে যান",
    },
    hero: {
      eyebrow: "বিকল্প ক্রেডিট ইন্টেলিজেন্স",
      title: "বিশ্বাসযোগ্য ক্রেডিটের সহজ পথ।",
      body: "AIRA প্রতিদিনের আর্থিক আচরণকে একটি ব্যক্তিগত ও সহজবোধ্য ট্রাস্ট প্রোফাইলে রূপ দেয়—যাতে ভালো রেকর্ড নতুন সুযোগ তৈরি করতে পারে।",
      primary: "AIRA শুরু করুন",
      secondary: "ডেমো দেখুন",
      note: "আপনার সম্মতিতে · বাংলাদেশের জন্য তৈরি",
    },
    visual: {
      label: "ব্যক্তিগত ট্রাস্ট প্রোফাইল",
      score: "৭৮",
      scoreLabel: "ট্রাস্ট সিগন্যাল",
      verified: "পরিচয় যাচাইকৃত",
      income: "আয়ের ধারাবাহিকতা",
      activity: "অ্যাকাউন্ট ব্যবহার",
      portable: "সহজে শেয়ারযোগ্য প্রোফাইল",
      updated: "এইমাত্র আপডেট হয়েছে",
    },
    signal: {
      eyebrow: "কেন এটি গুরুত্বপূর্ণ",
      title: "আপনার আর্থিক জীবন ইতিমধ্যেই একটি গল্প বলে।",
      body: "প্রচলিত ক্রেডিট ব্যবস্থা প্রতিদিন আয়, সঞ্চয় ও লেনদেন করা অনেক মানুষকে দেখতে পায় না। AIRA আপনার নিয়ন্ত্রণে সেই সংকেতগুলো বোঝা ও শেয়ার করা সহজ করে।",
      stats: [
        ["০১", "প্রতিদিনের তথ্য", "আপনার আর্থিক আচরণের পেছনের ধরনগুলো দেখুন।"],
        ["০২", "সহজ ব্যাখ্যা", "কোন অভ্যাস আপনার প্রোফাইলকে শক্তিশালী করে বুঝুন।"],
        ["০৩", "বেশি সুযোগ", "ঋণদাতা প্রতিষ্ঠানের সঙ্গে একটি শক্তিশালী ছবি শেয়ার করুন।"],
      ],
    },
    how: {
      eyebrow: "AIRA কীভাবে কাজ করে",
      title: "সহজ ধাপ। অর্থবহ সংকেত।",
      cards: [
        ["০১", "প্রোফাইল তৈরি করুন", "পরিচয় যাচাই করে আপনার ব্যক্তিগত AIRA অ্যাকাউন্ট তৈরি করুন।"],
        ["০২", "রেকর্ড যুক্ত করুন", "প্রতিটি ধাপে স্পষ্ট সম্মতির সঙ্গে আপনার বেছে নেওয়া স্টেটমেন্ট আপলোড করুন।"],
        ["০৩", "ট্রাস্ট প্রোফাইল দেখুন", "ঋণদাতারা যে অভ্যাসগুলো দেখেন সেগুলোর সহজবোধ্য ছবি পান।"],
      ],
    },
    features: {
      eyebrow: "বিশ্বাসকে কেন্দ্র করে তৈরি",
      title: "মানুষের জন্য উপকারী। ঋণদাতার জন্য পরিষ্কার।",
      body: "AIRA কাউকে একটি অব্যাখ্যাত সংখ্যায় পরিণত না করে উভয় পক্ষের জন্য আরও স্বচ্ছ একটি শুরু তৈরি করে।",
      items: [
        ["০১", "গোপনীয়তা আগে", "কী, কার সঙ্গে এবং কখন শেয়ার করবেন তা আপনি ঠিক করেন।"],
        ["০২", "ব্যাখ্যাযোগ্য অন্তর্দৃষ্টি", "প্রতিটি সংকেতকে সহজ ও ব্যবহারিক ভাষায় বোঝানো হয়।"],
        ["০৩", "দায়িত্বশীল সিদ্ধান্ত", "AIRA পর্যালোচনায় সহায়তা করে—মানুষের হয়ে ঋণের সিদ্ধান্ত নেয় না।"],
      ],
    },
    demo: {
      eyebrow: "AIRA-কে কাজে দেখুন",
      title: "অভিজ্ঞতার একটি ছোট পরিচয়।",
      body: "AIRA কীভাবে প্রতিদিনের রেকর্ডকে একটি পরিষ্কার আর্থিক কথোপকথনে রূপ দেয় তা দেখুন।",
      button: "YouTube ডেমো খুলুন",
      caption: "AIRA প্রোডাক্ট walkthrough",
    },
    team: {
      eyebrow: "AIRA-র পেছনের মানুষগুলো",
      title: "যত্ন ও কৌতূহল নিয়ে তৈরি।",
      body: "আমাদের পাঁচ সদস্যের দল আর্থিক সুযোগকে আরও সহজলভ্য ও বোধগম্য করতে কাজ করছে।",
      photo: "ছবি শীঘ্রই যুক্ত হবে",
    },
    faq: {
      eyebrow: "আপনার প্রশ্নের উত্তর",
      title: "শুরু করার একটি চিন্তাশীল জায়গা।",
      items: [
        ["AIRA কি ঋণদাতা?", "না। AIRA একটি ব্যাখ্যাযোগ্য ট্রাস্ট প্রোফাইল তৈরি করে। ঋণদাতা প্রতিষ্ঠান নিজের সিদ্ধান্ত নেয়।"],
        ["AIRA কোন তথ্য ব্যবহার করে?", "আপনি যে তথ্য দিতে চান, যেমন পরিচয়ের তথ্য এবং মোবাইল-মানি বা ব্যাংক স্টেটমেন্ট।"],
        ["কী শেয়ার হবে তা কি আমি নিয়ন্ত্রণ করতে পারি?", "হ্যাঁ। সম্মতি স্পষ্টভাবে নেওয়া হয় এবং ড্যাশবোর্ড থেকে তা প্রত্যাহার করা যায়।"],
      ],
    },
    footer: {
      line: "বিশ্বাস বোঝার মতো হওয়া উচিত।",
      enter: "AIRA পোর্টালে যান",
      rights: "AIRA · বিকল্প ক্রেডিট ইন্টেলিজেন্স",
    },
  },
};

const TEAM = [
  "Mahashweta Manjari Barua",
  "Dipannita Paul Orni",
  "Jannatul Ferdaus",
  "Krishnendu Barua",
  "Fariha Rayhan Mim",
];

function LanguageSwitch({ language, setLanguage }) {
  return (
    <div className="landing-language" role="group" aria-label="Language">
      {[
        ["bn", "বাংলা"],
        ["en", "English"],
      ].map(([code, label]) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <a className="landing-brand" href="#top" aria-label="AIRA home">
      <img src="/favicon.ico" alt="" width="40" height="40" />
      <span>AIRA</span>
    </a>
  );
}

function ProfilePreview({ copy }) {
  return (
    <div className="profile-preview" aria-label={copy.visual.label}>
      <div className="profile-preview-top">
        <span className="preview-kicker">AIRA / 2026</span>
        <span className="preview-status"><i /> {copy.visual.updated}</span>
      </div>
      <div className="profile-score-row">
        <div>
          <p className="preview-label">{copy.visual.label}</p>
          <p className="profile-score">{copy.visual.score}<small>/100</small></p>
          <p className="profile-score-label">{copy.visual.scoreLabel}</p>
        </div>
        <div className="score-ring"><span>AI</span></div>
      </div>
      <div className="profile-bars">
        <div className="profile-bar-row">
          <span>{copy.visual.verified}</span><b>100%</b>
          <i><em style={{ width: "100%" }} /></i>
        </div>
        <div className="profile-bar-row">
          <span>{copy.visual.income}</span><b>82%</b>
          <i><em style={{ width: "82%" }} /></i>
        </div>
        <div className="profile-bar-row">
          <span>{copy.visual.activity}</span><b>74%</b>
          <i><em style={{ width: "74%" }} /></i>
        </div>
      </div>
      <div className="profile-preview-bottom">
        <span className="portable-icon">↗</span>
        <span>{copy.visual.portable}</span>
        <span className="preview-arrow">→</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { language, setLanguage } = useLanguage();
  const copy = CONTENT[language] || CONTENT.en;

  return (
    <div className="landing-page" id="top">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">{copy.nav.how}</a>
          <a href="#why-aira">{copy.nav.features}</a>
          <a href="#team">{copy.nav.team}</a>
          <a href="#faq">{copy.nav.faq}</a>
        </nav>
        <div className="landing-nav-actions">
          <LanguageSwitch language={language} setLanguage={setLanguage} />
          <a className="landing-nav-cta" href="/app">{copy.nav.enter}<span>↗</span></a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="landing-eyebrow"><span /> {copy.hero.eyebrow}</p>
            <h1>{copy.hero.title}</h1>
            <p className="hero-body">{copy.hero.body}</p>
            <div className="hero-actions">
              <a className="landing-button landing-button-primary" href="/app">
                {copy.hero.primary}<span>↗</span>
              </a>
              <a className="landing-text-link" href="#demo">{copy.hero.secondary}<span>↓</span></a>
            </div>
            <p className="hero-note"><span>✦</span>{copy.hero.note}</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-grid" />
            <div className="hero-mark">A<span>•</span></div>
            <div className="hero-orb hero-orb-one" />
            <div className="hero-orb hero-orb-two" />
            <div className="hero-orb hero-orb-three" />
            <ProfilePreview copy={copy} />
          </div>
        </section>

        <section className="signal-section" id="why-aira">
          <div className="landing-container signal-layout">
            <div className="section-copy">
              <p className="landing-eyebrow"><span /> {copy.signal.eyebrow}</p>
              <h2>{copy.signal.title}</h2>
              <p>{copy.signal.body}</p>
            </div>
            <div className="signal-stats">
              {copy.signal.stats.map(([number, title, body]) => (
                <article key={number} className="signal-stat">
                  <span>{number}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-container" id="how-it-works">
          <div className="centered-heading">
            <p className="landing-eyebrow"><span /> {copy.how.eyebrow}</p>
            <h2>{copy.how.title}</h2>
          </div>
          <div className="step-cards">
            {copy.how.cards.map(([number, title, body], index) => (
              <article className={`step-card step-card-${index + 1}`} key={number}>
                <div className="step-number">{number}</div>
                <div className="step-icon" aria-hidden="true">{index === 0 ? "↗" : index === 1 ? "⌁" : "◌"}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="landing-container feature-layout">
            <div className="feature-copy">
              <p className="landing-eyebrow"><span /> {copy.features.eyebrow}</p>
              <h2>{copy.features.title}</h2>
              <p>{copy.features.body}</p>
              <a className="landing-text-link" href="/app">{copy.nav.enter}<span>↗</span></a>
            </div>
            <div className="feature-list">
              {copy.features.items.map(([number, title, body]) => (
                <article key={number} className="feature-row">
                  <span>{number}</span><div><h3>{title}</h3><p>{body}</p></div><b>+</b>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="demo-section landing-container" id="demo">
          <div className="demo-copy">
            <p className="landing-eyebrow"><span /> {copy.demo.eyebrow}</p>
            <h2>{copy.demo.title}</h2>
            <p>{copy.demo.body}</p>
            <a className="landing-button landing-button-light" href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer">
              {copy.demo.button}<span>↗</span>
            </a>
          </div>
          <a className="video-card" href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" aria-label={copy.demo.button}>
            <div className="video-screen">
              <div className="video-interface">
                <span className="video-dot" /><span /><span /><b>AIRA / product walkthrough</b>
              </div>
              <div className="video-dashboard">
                <div className="video-sidebar"><i /><i /><i /><i /></div>
                <div className="video-content"><strong>Trust profile</strong><div className="video-chart"><i /><i /><i /><i /><i /></div><div className="video-lines"><i /><i /><i /></div></div>
              </div>
              <div className="video-play">▶</div>
            </div>
            <div className="video-caption"><span>{copy.demo.caption}</span><b>Watch on YouTube ↗</b></div>
          </a>
        </section>

        <section className="team-section" id="team">
          <div className="landing-container">
            <div className="centered-heading team-heading">
              <p className="landing-eyebrow"><span /> {copy.team.eyebrow}</p>
              <h2>{copy.team.title}</h2>
              <p>{copy.team.body}</p>
            </div>
            <div className="team-grid">
              {TEAM.map((name, index) => (
                <article className="team-card" key={name}>
                  <div className="team-photo" aria-label={`${name} ${copy.team.photo}`}><span>{copy.team.photo}</span></div>
                  <p className="team-index">0{index + 1}</p>
                  <h3>{name}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="faq-section landing-container" id="faq">
          <div className="section-copy"><p className="landing-eyebrow"><span /> {copy.faq.eyebrow}</p><h2>{copy.faq.title}</h2></div>
          <div className="faq-list">
            {copy.faq.items.map(([question, answer]) => (
              <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container footer-top"><Brand /><p>{copy.footer.line}</p><a className="landing-button landing-button-primary" href="/app">{copy.footer.enter}<span>↗</span></a></div>
        <div className="landing-container footer-bottom"><span>© 2026 {copy.footer.rights}</span><span>AIRA / CUET</span></div>
      </footer>
    </div>
  );
}
