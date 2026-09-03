import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Bangla is the default: the primary audience is Bangladeshi borrowers, many
// of whom read Bangla far more comfortably than English. Lender and admin
// surfaces stay in English because those users work in English day to day.
const STORAGE_KEY = "aira_language";
export const LANGUAGES = [
  { code: "bn", label: "বাংলা" },
  { code: "en", label: "English" },
];

const en = {
  app: {
    name: "AIRA",
    tagline: "Alternative Credit Intelligence",
    skipToContent: "Skip to main content",
    borrower: "Borrower",
    lender: "Lender",
    adminPortal: "Admin portal",
    language: "Language",
    wrongPortal: "This account cannot access this portal.",
    loading: "Loading…",
    offline: "You appear to be offline. Check your connection and try again.",
  },
  common: {
    retry: "Try again",
    refresh: "Refresh",
    back: "Back",
    backToDashboard: "Back to dashboard",
    logout: "Log out",
    cancel: "Cancel",
    close: "Close",
    saving: "Saving…",
    loading: "Loading…",
    search: "Search",
    optional: "optional",
    required: "required",
    showMore: "Show more",
    of: "of",
    step: "Step",
    done: "Done",
    yes: "Yes",
    no: "No",
    verified: "Verified",
    pending: "Pending",
    phone: "Phone number",
    password: "Password",
  },
  auth: {
    signup: "Sign up",
    login: "Log in",
    loginTitle: "Log in to your account",
    createTitle: "Create your account",
    verifyTitle: "Verify your phone",
    detailsTitle: "Your identity details",
    steps: {
      phone: "Phone",
      identity: "Identity",
      consent: "Consent",
      statement: "Statement",
      profile: "Trust profile",
    },
    stepHelp: {
      phone: "We send a 6-digit code to your mobile number.",
      identity: "Enter your details exactly as they appear on your NID.",
      consent: "You choose what AIRA may look at.",
      statement: "Upload your bKash or bank statement.",
      profile: "See your trust tier and what to improve.",
    },
    sendOtp: "Send code",
    sending: "Sending…",
    otpLabel: "6-digit code",
    otpHelp: "Enter the code we sent to {phone}.",
    verifyOtp: "Verify code",
    verifying: "Verifying…",
    phoneVerified: "Your phone number is verified.",
    startOver: "Start over",
    changeNumber: "Use a different number",
    fullName: "Full name",
    dob: "Date of birth",
    nidNumber: "NID number",
    address: "Permanent address",
    nidFront: "NID photo — front",
    nidBack: "NID photo — back",
    nidHelp: "Take a clear photo. All four corners must be visible.",
    nidNotice:
      "Please fill every field exactly as it appears on your NID. A mismatch will delay verification.",
    createAccount: "Create account",
    creating: "Creating your account…",
    borrowerNote:
      "Your phone number is verified before we create your account. We never call you to ask for your code.",
    lenderNote:
      "Lender accounts are created by AIRA admin approval first. Sign up with the phone number your organisation was approved with.",
    passwordHelp: "At least 8 characters. You will use this to log in.",
    bothNidRequired: "Please add both the front and back photo of your NID.",
  },
  consent: {
    title: "Your data consent",
    granted: "Consent given",
    notGranted: "Consent not given",
    grant: "Give consent",
    withdraw: "Withdraw consent",
    lead: "Nothing is shared until you say yes. You can withdraw at any time.",
    sharedTitle: "What a lender can see when you apply",
    shared: [
      "Your name, phone number, and NID verification status",
      "Your trust tier and the behaviour categories behind it",
      "The statements you upload, and the patterns found in them",
    ],
    notSharedTitle: "What is never shared",
    notShared: [
      "Your password or your one-time codes",
      "Your data with any lender you have not applied to",
      "Your information for advertising or resale",
    ],
    withdrawNote:
      "If you withdraw consent, lenders immediately lose access to your profile and no new score can be calculated.",
    requiredForUpload: "Please give consent before uploading a statement.",
    requiredForRequest: "Please give consent before sending a loan request.",
  },
  borrower: {
    welcome: "Welcome, {name}",
    subtitle: "Build your trust profile and apply to lenders.",
    journey: "Your journey",
    journeyHelp: "Finish each step to unlock more lenders.",
    tierTitle: "Your trust tier",
    noTierTitle: "You do not have a trust profile yet",
    noTierBody:
      "Upload one mobile-money or bank statement and we will build your trust profile. It usually takes less than a minute.",
    tierNote:
      "AIRA does not approve or reject loans. A person at the lending organisation makes that decision.",
    tiers: {
      Bronze: "Bronze",
      Silver: "Silver",
      "Platinum/Gold": "Gold",
    },
    tierMeaning: {
      Bronze:
        "You are getting started. Keep using your account regularly and your profile will strengthen.",
      Silver:
        "You have a steady record. A little more consistency will open more lenders to you.",
      "Platinum/Gold":
        "You have a strong, consistent record. Most partner lenders will be able to review you.",
    },
    categories: "What your statement shows",
    categoriesHelp:
      "These are the habits lenders look at. Green means it is working in your favour.",
    nextSteps: "What to do next",
    historyTitle: "Your statement history",
    historyMonths: "{months} month(s) of history",
    historyTransactions: "{count} transaction(s) found",
    historyProgress: "{months} of {target} months",
    historyShort:
      "Your statement covers {months} month(s). Lenders prefer at least {target} months. Uploading a longer statement will make your profile much stronger.",
    historyGood:
      "Your statement covers {months} months, which meets the {target}-month history lenders look for.",
    lastUpdated: "Last updated {date}",
    openChat: "Ask the AI helper",
    chatIntro: "Ask about your profile in simple language.",
  },
  categories: {
    income_stability: {
      title: "Steady income",
      strong: "Money comes in regularly each month.",
      building: "Your income arrives, but the amounts change a lot month to month.",
      attention: "We could not see a regular pattern of money coming in.",
      tip: "Receive payments into the same account so your income is visible.",
    },
    savings_habit: {
      title: "Saving habit",
      strong: "You keep a healthy part of what you earn.",
      building: "You keep a little of what you earn each month.",
      attention: "You spend as much as or more than you receive.",
      tip: "Try to keep even a small amount in your account at month end.",
    },
    bill_discipline: {
      title: "Paying bills on time",
      strong: "You pay your bills regularly.",
      building: "You pay bills, but not always at a regular time.",
      attention: "We found few or no bill payments in your statement.",
      tip: "Pay utility or mobile bills from this account so the record is visible.",
    },
    account_activity: {
      title: "Account use",
      strong: "You use your account often and in varied ways.",
      building: "You use your account, but not very often.",
      attention: "There is very little activity in your account.",
      tip: "Use your mobile account for everyday payments instead of cash.",
    },
    spending_balance: {
      title: "Spending balance",
      strong: "Your spending sits comfortably below your income.",
      building: "Your spending is close to your income.",
      attention: "Your spending is higher than the income we can see.",
      tip: "Keep everyday spending below what comes in each month.",
    },
    record_length: {
      title: "Length of record",
      strong: "You have a long enough history for lenders to judge fairly.",
      building: "You have some history. A longer statement helps a lot.",
      attention: "Your history is very short, so lenders have little to look at.",
      tip: "Upload a statement covering the last six months if you can.",
    },
    levels: {
      strong: "Working for you",
      building: "Getting there",
      attention: "Needs attention",
    },
  },
  upload: {
    title: "Upload your statement",
    help: "Upload a bKash, Nagad, or bank statement so we can build your trust profile.",
    chooseFile: "Choose a file",
    changeFile: "Choose a different file",
    supported: "Accepted files: PDF or CSV",
    sizeLimit: "Maximum size: 10 MB",
    sourceHelp:
      "You can download a statement from your bKash or Nagad app, or ask your bank for one.",
    selected: "Selected: {name} ({size})",
    start: "Upload and build my profile",
    steps: {
      upload: "Sending your file",
      verify: "Checking the file is genuine",
      extract: "Reading your transactions",
      score: "Building your trust profile",
    },
    stepPending: "Waiting",
    stepActive: "In progress",
    stepDone: "Done",
    slowNote: "On a slow connection this can take a minute. Please keep this page open.",
    success: "Your trust profile is ready.",
    foundSummary: "We found {count} transaction(s) covering {months} month(s).",
    retry: "Try the upload again",
    keepFile: "Your file is still selected, so you can retry without choosing it again.",
    unsupported:
      "That file type is not supported. Please upload a PDF or CSV statement.",
    tooLarge: "That file is larger than 10 MB. Please upload a smaller statement.",
    consentFirst: "Please give consent above before uploading.",
  },
  lenders: {
    title: "Lending organisations",
    subtitle:
      "Send your profile to an organisation so a person there can review it.",
    count: "{count} organisation(s) available",
    empty: "No lending organisations are available yet.",
    emptyHelp:
      "An organisation appears here only after AIRA admin approves it and the organisation finishes its own signup. Please check back later.",
    approvalNote:
      "An approved organisation appears here only after it completes lender signup.",
    apply: "Send loan request",
    applyAgain: "Send a new request",
    sending: "Sending…",
    statusPending: "Waiting for review",
    statusAccepted: "Selected for a loan",
    statusDeclined: "Not selected this time",
    statusPendingHelp: "The organisation has your profile and will review it.",
    statusAcceptedHelp: "They will contact you on your registered phone number.",
    statusDeclinedHelp: "You can apply again, or apply to another organisation.",
    joined: "Partner since {date}",
    refreshed: "Updated just now",
    needProfile: "Build your trust profile before applying.",
  },
  chat: {
    borrowerTitle: "AI helper",
    lenderTitle: "AI decision support",
    borrowerIntro:
      "Ask a question about your profile. The helper only uses your own information.",
    lenderIntro:
      "Ask about this applicant's score, factors, and anomalies. Answers are grounded in the applicant's record.",
    suggested: "Try asking",
    placeholder: "Type your question…",
    placeholderDisabled: "Build your trust profile first.",
    send: "Send",
    sending: "Thinking…",
    emptyBorrower: "No questions yet. Pick one below to start.",
    emptyLender: "No questions yet. Pick one below to start.",
    noScore: "There is no trust profile to talk about yet.",
    noScoreLender: "This applicant has no trust score yet, so answers would have no evidence to rest on.",
    failed: "The helper could not answer. Your question was kept.",
    open: "Open AIRA helper",
    close: "Close AIRA helper",
    grounding: {
      label: "Based on",
      score_factors: "Score factors",
      applicant_records: "Applicant records",
      general_guidance: "General guidance",
    },
    disclaimer:
      "AI answers are guidance only and are not a lending decision.",
    lenderDisclaimer:
      "Decision support only. AIRA does not approve or reject applications — you do.",
    you: "You",
    assistant: "AIRA helper",
    borrowerSuggestions: [
      "How can I improve my trust profile?",
      "Why is my record considered short?",
      "What do lenders look at first?",
      "How do I get to the next tier?",
    ],
    lenderSuggestions: [
      "Why is this applicant's score where it is?",
      "Is the income variation seasonal or genuine instability?",
      "Which factors reduce this applicant's score the most?",
      "What should I verify before deciding?",
    ],
  },
  lender: {
    workspace: "Lender workspace",
    welcome: "Welcome, {name}",
    subtitle: "Review applicants and make lending decisions.",
    inbox: "Loan requests",
    inboxHelp:
      "Applicants who applied to your organisation. Open one to review their profile, statements, and trust score.",
    newCount: "{count} new",
    empty: "No loan requests received yet.",
    emptyHelp: "Borrowers who apply to your organisation will appear here.",
    filterAll: "All",
    filterPending: "Pending",
    filterAccepted: "Accepted",
    filterDeclined: "Declined",
    searchPlaceholder: "Search by name or phone",
    noMatches: "No requests match your filters.",
    clearFilters: "Clear filters",
    loadMore: "Load more",
    showingCount: "Showing {shown} of {total}",
    lookup: "Look up a borrower",
    lookupHelp: "Enter a borrower ID or phone number to view their trust score.",
    lookupPlaceholder: "Borrower ID or phone",
    loadScore: "Load score",
    profile: "Applicant profile",
    trustScore: "Trust score",
    scoreOf: "{score} / 100",
    riskLevel: "Risk level",
    tier: "Tier",
    noScore: "This applicant has not computed a trust score yet.",
    factors: "Contributing factors",
    factorsHelp:
      "SHAP contributions from the scoring model, strongest first. Positive values support the score; negative values reduce it.",
    supporting: "Supports",
    reducing: "Reduces",
    seasonality: "Income pattern",
    anomalies: "Anomaly warnings",
    noAnomalies: "No anomaly signals were raised for this applicant.",
    anomaliesHelp:
      "Flags for your review. They are not rejections and are not applied automatically.",
    severity: { high: "High", medium: "Medium", low: "Note" },
    history: "Statement coverage",
    statements: "Uploaded statements",
    noStatements: "No statements uploaded.",
    viewStatement: "Open statement",
    decision: "Your decision",
    decisionHelp:
      "AIRA does not decide. Record your decision and the reasoning behind it.",
    accept: "Select for loan",
    decline: "Decline",
    reasonLabel: "Reason for your decision",
    reasonHelp:
      "Required. This is stored with the decision for audit and oversight.",
    reasonPlaceholder: "Explain the main reason for this decision…",
    reasonTooShort: "Please write at least 10 characters.",
    confirmAccept: "Confirm selection",
    confirmDecline: "Confirm decline",
    submitting: "Saving decision…",
    decided: "Decision recorded: {status}",
    decidedReason: "Reason given: {reason}",
    aiLabel: "AI decision support — not a decision",
  },
  admin: {
    portal: "Admin portal",
    welcome: "Welcome, {name}",
    subtitle: "Approve lending organisations and oversee the platform.",
    lenderApproval: "Lender approval",
    lenderApprovalHelp: "Create an approval or review organisations awaiting signup.",
    newApproval: "New lender approval",
    pendingSignup: "Approved, awaiting signup",
    awaitingReview: "Awaiting your review",
    noReview: "No approvals are awaiting review.",
    noPendingSignup: "No approved organisations are waiting to sign up.",
    approve: "Approve organisation",
    approving: "Approving…",
    orgName: "Organisation name",
    orgPhone: "Organisation phone number",
    createApproval: "Create approval",
    creating: "Creating…",
    docsHelp: "Accepted files: image or PDF, up to 10 MB each.",
    approvedNote: "Approved — organisation must still complete OTP signup",
    backToApproval: "Back to lender approval",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "We could not reach AIRA. Check your internet connection.",
    loadLenders: "We could not load the list of organisations.",
    loadRequests: "We could not load your loan requests.",
    loadProfile: "We could not load this applicant's profile.",
  },
};

const bn = {
  app: {
    name: "AIRA",
    tagline: "বিকল্প ক্রেডিট ইন্টেলিজেন্স",
    skipToContent: "মূল অংশে যান",
    borrower: "ঋণগ্রহীতা",
    lender: "ঋণদাতা",
    adminPortal: "অ্যাডমিন পোর্টাল",
    language: "ভাষা",
    wrongPortal: "এই অ্যাকাউন্ট দিয়ে এই পোর্টালে প্রবেশ করা যাবে না।",
    loading: "লোড হচ্ছে…",
    offline: "আপনি সম্ভবত অফলাইনে আছেন। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
  },
  common: {
    retry: "আবার চেষ্টা করুন",
    refresh: "রিফ্রেশ করুন",
    back: "পেছনে",
    backToDashboard: "ড্যাশবোর্ডে ফিরুন",
    logout: "লগ আউট",
    cancel: "বাতিল",
    close: "বন্ধ করুন",
    saving: "সংরক্ষণ হচ্ছে…",
    loading: "লোড হচ্ছে…",
    search: "খুঁজুন",
    optional: "ঐচ্ছিক",
    required: "আবশ্যক",
    showMore: "আরও দেখুন",
    of: "এর",
    step: "ধাপ",
    done: "সম্পন্ন",
    yes: "হ্যাঁ",
    no: "না",
    verified: "যাচাই হয়েছে",
    pending: "অপেক্ষমাণ",
    phone: "মোবাইল নম্বর",
    password: "পাসওয়ার্ড",
  },
  auth: {
    signup: "নতুন অ্যাকাউন্ট",
    login: "লগ ইন",
    loginTitle: "আপনার অ্যাকাউন্টে লগ ইন করুন",
    createTitle: "আপনার অ্যাকাউন্ট তৈরি করুন",
    verifyTitle: "আপনার নম্বর যাচাই করুন",
    detailsTitle: "আপনার পরিচয়ের তথ্য",
    steps: {
      phone: "মোবাইল",
      identity: "পরিচয়",
      consent: "সম্মতি",
      statement: "স্টেটমেন্ট",
      profile: "ট্রাস্ট প্রোফাইল",
    },
    stepHelp: {
      phone: "আপনার মোবাইলে ৬ সংখ্যার একটি কোড পাঠানো হবে।",
      identity: "আপনার NID-তে যেভাবে লেখা আছে, ঠিক সেভাবে তথ্য দিন।",
      consent: "AIRA কী দেখতে পারবে তা আপনি ঠিক করবেন।",
      statement: "আপনার বিকাশ বা ব্যাংক স্টেটমেন্ট আপলোড করুন।",
      profile: "আপনার ট্রাস্ট টিয়ার ও করণীয় দেখুন।",
    },
    sendOtp: "কোড পাঠান",
    sending: "পাঠানো হচ্ছে…",
    otpLabel: "৬ সংখ্যার কোড",
    otpHelp: "{phone} নম্বরে পাঠানো কোডটি লিখুন।",
    verifyOtp: "কোড যাচাই করুন",
    verifying: "যাচাই হচ্ছে…",
    phoneVerified: "আপনার মোবাইল নম্বর যাচাই হয়েছে।",
    startOver: "শুরু থেকে করুন",
    changeNumber: "অন্য নম্বর ব্যবহার করুন",
    fullName: "পূর্ণ নাম",
    dob: "জন্ম তারিখ",
    nidNumber: "NID নম্বর",
    address: "স্থায়ী ঠিকানা",
    nidFront: "NID ছবি — সামনের দিক",
    nidBack: "NID ছবি — পেছনের দিক",
    nidHelp: "পরিষ্কার ছবি তুলুন। কার্ডের চারটি কোণাই দেখা যেতে হবে।",
    nidNotice:
      "আপনার NID-তে যেভাবে লেখা আছে ঠিক সেভাবে প্রতিটি ঘর পূরণ করুন। না মিললে যাচাই করতে দেরি হবে।",
    createAccount: "অ্যাকাউন্ট তৈরি করুন",
    creating: "অ্যাকাউন্ট তৈরি হচ্ছে…",
    borrowerNote:
      "অ্যাকাউন্ট তৈরির আগে আপনার নম্বর যাচাই করা হয়। আমরা কখনো ফোন করে আপনার কোড চাইব না।",
    lenderNote:
      "ঋণদাতা অ্যাকাউন্ট আগে AIRA অ্যাডমিন অনুমোদন করে। অনুমোদিত নম্বর দিয়েই সাইন আপ করুন।",
    passwordHelp: "কমপক্ষে ৮টি অক্ষর। এটি দিয়েই আপনি লগ ইন করবেন।",
    bothNidRequired: "NID-এর সামনের ও পেছনের দুটো ছবিই দিন।",
  },
  consent: {
    title: "আপনার তথ্যের সম্মতি",
    granted: "সম্মতি দেওয়া হয়েছে",
    notGranted: "সম্মতি দেওয়া হয়নি",
    grant: "সম্মতি দিন",
    withdraw: "সম্মতি প্রত্যাহার করুন",
    lead: "আপনি হ্যাঁ না বলা পর্যন্ত কিছুই শেয়ার করা হয় না। যেকোনো সময় প্রত্যাহার করতে পারেন।",
    sharedTitle: "আবেদন করলে ঋণদাতা যা দেখতে পাবে",
    shared: [
      "আপনার নাম, মোবাইল নম্বর এবং NID যাচাইয়ের অবস্থা",
      "আপনার ট্রাস্ট টিয়ার এবং তার পেছনের আচরণগত বিষয়গুলো",
      "আপনার আপলোড করা স্টেটমেন্ট ও তাতে পাওয়া প্যাটার্ন",
    ],
    notSharedTitle: "যা কখনো শেয়ার করা হয় না",
    notShared: [
      "আপনার পাসওয়ার্ড বা ওয়ান-টাইম কোড",
      "আপনি আবেদন করেননি এমন কোনো ঋণদাতার সাথে আপনার তথ্য",
      "বিজ্ঞাপন বা বিক্রির জন্য আপনার তথ্য",
    ],
    withdrawNote:
      "সম্মতি প্রত্যাহার করলে ঋণদাতারা সঙ্গে সঙ্গে আপনার প্রোফাইল দেখা বন্ধ করবে এবং নতুন স্কোর তৈরি হবে না।",
    requiredForUpload: "স্টেটমেন্ট আপলোডের আগে সম্মতি দিন।",
    requiredForRequest: "ঋণের অনুরোধ পাঠানোর আগে সম্মতি দিন।",
  },
  borrower: {
    welcome: "স্বাগতম, {name}",
    subtitle: "আপনার ট্রাস্ট প্রোফাইল তৈরি করুন এবং ঋণদাতার কাছে আবেদন করুন।",
    journey: "আপনার ধাপগুলো",
    journeyHelp: "প্রতিটি ধাপ শেষ করলে আরও ঋণদাতা আপনার জন্য খুলবে।",
    tierTitle: "আপনার ট্রাস্ট টিয়ার",
    noTierTitle: "আপনার এখনো ট্রাস্ট প্রোফাইল নেই",
    noTierBody:
      "একটি মোবাইল ব্যাংকিং বা ব্যাংক স্টেটমেন্ট আপলোড করুন, আমরা আপনার প্রোফাইল তৈরি করে দেব। সাধারণত এক মিনিটেরও কম সময় লাগে।",
    tierNote:
      "AIRA ঋণ অনুমোদন বা বাতিল করে না। সিদ্ধান্ত নেন ঋণদাতা প্রতিষ্ঠানের একজন মানুষ।",
    tiers: {
      Bronze: "ব্রোঞ্জ",
      Silver: "সিলভার",
      "Platinum/Gold": "গোল্ড",
    },
    tierMeaning: {
      Bronze:
        "আপনি সবে শুরু করেছেন। নিয়মিত অ্যাকাউন্ট ব্যবহার করলে প্রোফাইল শক্তিশালী হবে।",
      Silver:
        "আপনার রেকর্ড মোটামুটি স্থিতিশীল। আরেকটু নিয়মিত হলে আরও ঋণদাতা খুলবে।",
      "Platinum/Gold":
        "আপনার রেকর্ড শক্তিশালী ও ধারাবাহিক। অধিকাংশ অংশীদার ঋণদাতা আপনাকে বিবেচনা করতে পারবে।",
    },
    categories: "আপনার স্টেটমেন্ট যা দেখাচ্ছে",
    categoriesHelp:
      "ঋণদাতারা এই অভ্যাসগুলো দেখে। সবুজ মানে এটি আপনার পক্ষে কাজ করছে।",
    nextSteps: "এখন যা করবেন",
    historyTitle: "আপনার স্টেটমেন্টের ইতিহাস",
    historyMonths: "{months} মাসের ইতিহাস",
    historyTransactions: "{count}টি লেনদেন পাওয়া গেছে",
    historyProgress: "{target} মাসের মধ্যে {months} মাস",
    historyShort:
      "আপনার স্টেটমেন্টে {months} মাসের তথ্য আছে। ঋণদাতারা কমপক্ষে {target} মাস চান। দীর্ঘ স্টেটমেন্ট দিলে আপনার প্রোফাইল অনেক শক্তিশালী হবে।",
    historyGood:
      "আপনার স্টেটমেন্টে {months} মাসের তথ্য আছে, যা ঋণদাতাদের চাওয়া {target} মাসের সমান বা বেশি।",
    lastUpdated: "সর্বশেষ হালনাগাদ {date}",
    openChat: "AI সহায়ককে জিজ্ঞাসা করুন",
    chatIntro: "সহজ ভাষায় আপনার প্রোফাইল নিয়ে প্রশ্ন করুন।",
  },
  categories: {
    income_stability: {
      title: "নিয়মিত আয়",
      strong: "প্রতি মাসে নিয়মিত টাকা আসে।",
      building: "টাকা আসে, তবে প্রতি মাসে পরিমাণ অনেক বদলায়।",
      attention: "নিয়মিত টাকা আসার কোনো ধরন আমরা দেখতে পাইনি।",
      tip: "একই অ্যাকাউন্টে টাকা গ্রহণ করুন, যাতে আপনার আয় দেখা যায়।",
    },
    savings_habit: {
      title: "সঞ্চয়ের অভ্যাস",
      strong: "আয়ের ভালো একটি অংশ আপনি রেখে দেন।",
      building: "প্রতি মাসে আয়ের সামান্য অংশ আপনি রাখেন।",
      attention: "আয়ের সমান বা তার বেশি খরচ হয়ে যায়।",
      tip: "মাস শেষে অল্প হলেও কিছু টাকা অ্যাকাউন্টে রাখার চেষ্টা করুন।",
    },
    bill_discipline: {
      title: "সময়মতো বিল পরিশোধ",
      strong: "আপনি নিয়মিত বিল পরিশোধ করেন।",
      building: "বিল দেন, তবে সব সময় নিয়মিত সময়ে নয়।",
      attention: "স্টেটমেন্টে বিল পরিশোধ খুব কম বা নেই।",
      tip: "বিদ্যুৎ বা মোবাইলের বিল এই অ্যাকাউন্ট থেকে দিন, যাতে রেকর্ড থাকে।",
    },
    account_activity: {
      title: "অ্যাকাউন্টের ব্যবহার",
      strong: "আপনি অ্যাকাউন্ট নিয়মিত ও নানা কাজে ব্যবহার করেন।",
      building: "আপনি অ্যাকাউন্ট ব্যবহার করেন, তবে খুব বেশি নয়।",
      attention: "আপনার অ্যাকাউন্টে লেনদেন খুবই কম।",
      tip: "নগদের বদলে দৈনন্দিন খরচে মোবাইল অ্যাকাউন্ট ব্যবহার করুন।",
    },
    spending_balance: {
      title: "খরচের ভারসাম্য",
      strong: "আপনার খরচ আয়ের চেয়ে স্বস্তিদায়কভাবে কম।",
      building: "আপনার খরচ প্রায় আয়ের সমান।",
      attention: "আমরা যে আয় দেখতে পাচ্ছি, খরচ তার চেয়ে বেশি।",
      tip: "প্রতি মাসে যা আসে, দৈনন্দিন খরচ তার চেয়ে কম রাখুন।",
    },
    record_length: {
      title: "রেকর্ডের দৈর্ঘ্য",
      strong: "ন্যায্যভাবে বিচার করার মতো যথেষ্ট ইতিহাস আপনার আছে।",
      building: "কিছু ইতিহাস আছে। আরও দীর্ঘ স্টেটমেন্ট অনেক সাহায্য করবে।",
      attention: "আপনার ইতিহাস খুব সংক্ষিপ্ত, তাই ঋণদাতার দেখার মতো কিছু কম।",
      tip: "সম্ভব হলে গত ছয় মাসের স্টেটমেন্ট আপলোড করুন।",
    },
    levels: {
      strong: "আপনার পক্ষে",
      building: "উন্নতি হচ্ছে",
      attention: "নজর দিন",
    },
  },
  upload: {
    title: "আপনার স্টেটমেন্ট আপলোড করুন",
    help: "বিকাশ, নগদ বা ব্যাংক স্টেটমেন্ট দিন, আমরা আপনার ট্রাস্ট প্রোফাইল তৈরি করব।",
    chooseFile: "ফাইল বাছাই করুন",
    changeFile: "অন্য ফাইল বাছাই করুন",
    supported: "গ্রহণযোগ্য ফাইল: PDF বা CSV",
    sizeLimit: "সর্বোচ্চ আকার: ১০ MB",
    sourceHelp:
      "বিকাশ বা নগদ অ্যাপ থেকে স্টেটমেন্ট নামাতে পারেন, অথবা ব্যাংক থেকে চেয়ে নিতে পারেন।",
    selected: "বাছাই করা হয়েছে: {name} ({size})",
    start: "আপলোড করে প্রোফাইল তৈরি করুন",
    steps: {
      upload: "ফাইল পাঠানো হচ্ছে",
      verify: "ফাইলটি আসল কি না দেখা হচ্ছে",
      extract: "আপনার লেনদেন পড়া হচ্ছে",
      score: "ট্রাস্ট প্রোফাইল তৈরি হচ্ছে",
    },
    stepPending: "অপেক্ষমাণ",
    stepActive: "চলছে",
    stepDone: "সম্পন্ন",
    slowNote: "ধীর ইন্টারনেটে এক মিনিট লাগতে পারে। পেজটি খোলা রাখুন।",
    success: "আপনার ট্রাস্ট প্রোফাইল প্রস্তুত।",
    foundSummary: "{months} মাসজুড়ে {count}টি লেনদেন পাওয়া গেছে।",
    retry: "আবার আপলোড করার চেষ্টা করুন",
    keepFile: "আপনার ফাইলটি বাছাই করা আছে, তাই আবার বাছাই না করেই চেষ্টা করতে পারেন।",
    unsupported: "এই ধরনের ফাইল চলবে না। PDF বা CSV স্টেটমেন্ট দিন।",
    tooLarge: "ফাইলটি ১০ MB-এর বেশি। ছোট একটি স্টেটমেন্ট দিন।",
    consentFirst: "আপলোডের আগে উপরে সম্মতি দিন।",
  },
  lenders: {
    title: "ঋণদাতা প্রতিষ্ঠান",
    subtitle: "কোনো প্রতিষ্ঠানে আপনার প্রোফাইল পাঠান, সেখানকার একজন মানুষ তা দেখবেন।",
    count: "{count}টি প্রতিষ্ঠান পাওয়া যাচ্ছে",
    empty: "এখনো কোনো ঋণদাতা প্রতিষ্ঠান নেই।",
    emptyHelp:
      "AIRA অ্যাডমিন অনুমোদন দেওয়ার পর এবং প্রতিষ্ঠানটি নিজের সাইন আপ শেষ করলে তবেই এখানে দেখা যায়। কিছুক্ষণ পর আবার দেখুন।",
    approvalNote:
      "অনুমোদিত প্রতিষ্ঠান ঋণদাতা সাইন আপ শেষ করার পরেই এখানে দেখা যাবে।",
    apply: "ঋণের অনুরোধ পাঠান",
    applyAgain: "নতুন অনুরোধ পাঠান",
    sending: "পাঠানো হচ্ছে…",
    statusPending: "পর্যালোচনার অপেক্ষায়",
    statusAccepted: "ঋণের জন্য নির্বাচিত",
    statusDeclined: "এবার নির্বাচিত হননি",
    statusPendingHelp: "প্রতিষ্ঠানটি আপনার প্রোফাইল পেয়েছে এবং পর্যালোচনা করবে।",
    statusAcceptedHelp: "তারা আপনার নিবন্ধিত নম্বরে যোগাযোগ করবে।",
    statusDeclinedHelp: "আপনি আবার আবেদন করতে পারেন, বা অন্য প্রতিষ্ঠানে চেষ্টা করতে পারেন।",
    joined: "{date} থেকে অংশীদার",
    refreshed: "এইমাত্র হালনাগাদ হয়েছে",
    needProfile: "আবেদনের আগে আপনার ট্রাস্ট প্রোফাইল তৈরি করুন।",
  },
  chat: {
    borrowerTitle: "AI সহায়ক",
    lenderTitle: "AI decision support",
    borrowerIntro:
      "আপনার প্রোফাইল নিয়ে প্রশ্ন করুন। সহায়ক শুধু আপনার নিজের তথ্যই ব্যবহার করে।",
    lenderIntro:
      "Ask about this applicant's score, factors, and anomalies. Answers are grounded in the applicant's record.",
    suggested: "এগুলো জিজ্ঞাসা করে দেখুন",
    placeholder: "আপনার প্রশ্ন লিখুন…",
    placeholderDisabled: "আগে আপনার ট্রাস্ট প্রোফাইল তৈরি করুন।",
    send: "পাঠান",
    sending: "ভাবছে…",
    emptyBorrower: "এখনো কোনো প্রশ্ন নেই। নিচ থেকে একটি বেছে শুরু করুন।",
    emptyLender: "No questions yet. Pick one below to start.",
    noScore: "এখনো কোনো ট্রাস্ট প্রোফাইল নেই যা নিয়ে কথা বলা যায়।",
    noScoreLender:
      "This applicant has no trust score yet, so answers would have no evidence to rest on.",
    failed: "সহায়ক উত্তর দিতে পারেনি। আপনার প্রশ্নটি রাখা হয়েছে।",
    open: "AIRA সহায়ক খুলুন",
    close: "AIRA সহায়ক বন্ধ করুন",
    grounding: {
      label: "ভিত্তি",
      score_factors: "স্কোরের কারণসমূহ",
      applicant_records: "আবেদনকারীর রেকর্ড",
      general_guidance: "সাধারণ পরামর্শ",
    },
    disclaimer: "AI-এর উত্তর কেবল পরামর্শ, এটি ঋণের সিদ্ধান্ত নয়।",
    lenderDisclaimer:
      "Decision support only. AIRA does not approve or reject applications — you do.",
    you: "আপনি",
    assistant: "AIRA সহায়ক",
    borrowerSuggestions: [
      "আমার ট্রাস্ট প্রোফাইল কীভাবে উন্নত করব?",
      "আমার রেকর্ড কেন সংক্ষিপ্ত ধরা হচ্ছে?",
      "ঋণদাতারা প্রথমে কী দেখে?",
      "পরবর্তী টিয়ারে যেতে আমাকে কী করতে হবে?",
    ],
    lenderSuggestions: [
      "Why is this applicant's score where it is?",
      "Is the income variation seasonal or genuine instability?",
      "Which factors reduce this applicant's score the most?",
      "What should I verify before deciding?",
    ],
  },
  lender: en.lender,
  admin: en.admin,
  errors: {
    generic: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    network: "AIRA-এর সাথে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখুন।",
    loadLenders: "প্রতিষ্ঠানের তালিকা লোড করা যায়নি।",
    loadRequests: "আপনার ঋণের অনুরোধগুলো লোড করা যায়নি।",
    loadProfile: "এই আবেদনকারীর প্রোফাইল লোড করা যায়নি।",
  },
};

const DICTIONARIES = { en, bn };

function lookup(dictionary, key) {
  return key
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

function interpolate(value, vars) {
  if (typeof value !== "string" || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    // Safari private mode and some embedded webviews expose localStorage but
    // throw on access, so reading it must never be allowed to break startup.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "en" || stored === "bn" ? stored : "bn";
    } catch (_error) {
      return "bn";
    }
  });

  const setLanguage = useCallback((next) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_error) {
      // A blocked localStorage should never break the language switch.
    }
  }, []);

  // Keeps <html lang> in sync from the very first render, which drives the
  // :lang(bn) line-height rule and tells screen readers which language to use.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo(() => {
    const dictionary = DICTIONARIES[language] || DICTIONARIES.bn;

    // Falls back to English, then to the key itself, so a missing Bangla
    // string degrades to readable text instead of a blank screen.
    const t = (key, vars) => {
      const found = lookup(dictionary, key) ?? lookup(DICTIONARIES.en, key);
      if (Array.isArray(found)) return found;
      return found === undefined ? key : interpolate(found, vars);
    };

    return { language, setLanguage, t };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return context;
}
