Chart.defaults.color = '#8891AC';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12.5;

const gridColor = 'rgba(237,239,245,0.06)';
const amber = '#F5A623';
const teal = '#4FD1C5';
const coral = '#FF6B6B';
const violet = '#7C6CF0';
const paper = '#EDEFF5';
const muted = '#8891AC';

// How often to poll while the page stays open. The Apps Script side
// caches its response for 2 minutes, so polling faster than that just
// re-serves the same cached JSON without extra sheet reads.
const REFRESH_INTERVAL_MS = 60 * 1000;

// Last-known-good snapshot, used only if the very first fetch fails
// before any live data has ever loaded.
const FALLBACK_DATA = {
  totalApplicants: 60,
  cities: {
    "City of Santa Rosa": 20, "City of Cabuyao": 18, "City of Biñan": 7,
    "City of Calamba": 4, "City of San Pedro": 4, "Outside Laguna": 3,
    "City of San Pablo": 2, "Santa Cruz": 1, "Los Baños": 1
  },
  affiliations: {
    "Undergraduate Tech Student (IT, CS, CpE, etc.)": 51,
    "Employed Tech Professional (Software Engineer, QA, PM, UI/UX, etc.)": 5,
    "Undergraduate Non-Tech Student": 2,
    "Freelancer / Self-Employed Developer": 1,
    "Tech Enthusiast / Career Switcher": 1
  },
  techStacks: { frontend: 43, backend: 36, mobile: 22, datascience: 32, uiux: 32, cybersecurity: 24, cloud: 20, projectmgmt: 19, blockchain: 10, other: 0 },
  motivations: { networking: 59, hackathons: 26, upskilling: 54, mentorship: 49, civic: 33 },
  skillLevels: { "1": 2, "2": 20, "3": 27, "4": 11, "5": 0 },
  volunteerInterest: { "Yes, sign me up! I want an active volunteer/committee role.": 40, "Maybe later. I prefer to start as a general member first.": 20 },
  committees: { program: 25, tech: 22, marketing: 15, finance: 11, comms: 10, partnership: 7, unspecified: 0 },
  committeeRespondents: 44,
  learnKeywords: {
    "react": 15, "python": 12, "node": 9, "figma": 8, "git": 7, "docker": 6,
    "javascript": 10, "tailwind": 5, "aws": 4, "flutter": 4, "sql": 3, "mongodb": 3
  }
};

function tip(){
  return {
    backgroundColor: '#1C2440', borderColor: 'rgba(237,239,245,0.12)', borderWidth:1,
    titleColor: paper, bodyColor: paper, padding:10,
    titleFont:{family:"'Space Grotesk', sans-serif", weight:600},
    bodyFont:{family:"'JetBrains Mono', monospace"}
  };
}

let charts = {};
let lastUpdated = null;
let hasLoadedOnce = false;

function initCharts(d) {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};

  charts.composition = new Chart(document.getElementById('chartComposition'), {
    type:'doughnut',
    data:{
      labels:['Undergrad Tech Student','Employed Tech Professional','Undergrad Non-Tech Student','Freelancer / Self-Employed Dev','Tech Enthusiast / Career Switcher'],
      datasets:[{ data:[d.undergradTech, d.employedTech, d.undergradNonTech, d.freelancer, d.enthusiast],
        backgroundColor:[amber, teal, '#2A3355', violet, coral], borderColor:'#161D33', borderWidth:4 }]
    },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, boxHeight:10, padding:14, font:{size:11}}}, tooltip: tip() } }
  });

  charts.geo = new Chart(document.getElementById('chartGeo'), {
    type:'bar',
    data:{ labels: d.geoLabels, datasets:[{ data: d.geoValues,
      backgroundColor: d.geoValues.map((_,i) => i===0?amber : i===1?teal : i===2?violet : '#2A3355'),
      borderRadius:6, barThickness:26 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip: tip()},
      scales:{ x:{grid:{color:gridColor}, ticks:{stepSize:5}}, y:{grid:{display:false}, ticks:{color:paper, font:{size:12.5}}} } }
  });

  charts.interests = new Chart(document.getElementById('chartInterests'), {
    type:'bar',
    data:{
      labels:[['Frontend Web','Development'],['Backend Web','Development'],['Data Science /','AI / ML'],
        ['UI/UX Design &','Product Research'],['Cybersecurity &','Network Admin.'],['Mobile App','Development'],
        ['Cloud Computing','& DevOps'],['Project Mgmt /','Agile Scrum'],['Blockchain /','Web3 Technologies']],
      datasets:[{ data:[d.frontend, d.backend, d.datascience, d.uiux, d.cybersecurity, d.mobile, d.cloud, d.projectmgmt, d.blockchain],
        backgroundColor:[amber, teal, violet, violet, coral, '#2A3355','#2A3355','#2A3355','#2A3355'],
        borderRadius:6, barThickness:26 }]
    },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip: tip()},
      scales:{ x:{grid:{color:gridColor}, ticks:{stepSize:10}}, y:{grid:{display:false}, ticks:{color:paper, font:{size:12.5}}} } }
  });

  charts.skill = new Chart(document.getElementById('chartSkill'), {
    type:'bar',
    data:{ labels:['1','2','3','4','5'],
      datasets:[{ data:[d.lvl1, d.lvl2, d.lvl3, d.lvl4, d.lvl5],
        backgroundColor:['#2A3355', teal, teal, '#2A3355', '#2A3355'], borderRadius:6, barThickness:44 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip: tip()},
      scales:{ x:{grid:{display:false}, title:{display:true, text:'Self-rated skill (1=beginner, 5=advanced)', color:muted, font:{size:11.5}}},
               y:{grid:{color:gridColor}, beginAtZero:true} } }
  });

  charts.motivation = new Chart(document.getElementById('chartMotivation'), {
    type:'bar',
    data:{ labels:[['Networking with','tech peers & industry'],['Upskilling via','workshops & bootcamps'],
        ['Mentorship &','career/job opportunities'],['Contributing to','civic tech / open-source'],['Hackathons &','coding competitions']],
      datasets:[{ data:[d.networking, d.upskilling, d.mentorship, d.civic, d.hackathons],
        backgroundColor:[amber, teal, violet, '#2A3355','#2A3355'], borderRadius:6, barThickness:32 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip: tip()},
      scales:{ x:{grid:{color:gridColor}, ticks:{stepSize:10}}, y:{grid:{display:false}, ticks:{color:paper}} } }
  });

  charts.volunteer = new Chart(document.getElementById('chartVolunteer'), {
    type:'doughnut',
    data:{ labels:['Wants volunteer/committee role','Prefers general member for now'],
      datasets:[{ data:[d.volunteerYes, d.volunteerNo], backgroundColor:[teal,'#2A3355'], borderColor:'#161D33', borderWidth:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, boxHeight:10, padding:16, font:{size:12}}}, tooltip: tip() } }
  });

  charts.committee = new Chart(document.getElementById('chartCommittee'), {
    type:'bar',
    data:{ labels:[['In-event Program','Operations'],'Technical & Dev.',['Marketing, Creatives','& Content'],
        'Finance & Logistics',['Internal & External','Communications'],['Partnership &','Fundraising']],
      datasets:[{ data:[d.program, d.tech, d.marketing, d.finance, d.comms, d.partnership],
        backgroundColor:[amber, teal, violet, '#2A3355','#2A3355', coral], borderRadius:6, barThickness:32 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip: tip()},
      scales:{ x:{grid:{color:gridColor}}, y:{grid:{display:false}, ticks:{color:paper, font:{size:12.5}}} } }
  });
}

function processAndRender(apiData) {
  const total = apiData.totalApplicants || 0;

  // --- affiliation (single-select, exact-key lookup) ---
  const aff = apiData.affiliations || {};
  const undergradTech = aff["Undergraduate Tech Student (IT, CS, CpE, etc.)"] || 0;
  const employedTech = aff["Employed Tech Professional (Software Engineer, QA, PM, UI/UX, etc.)"] || 0;
  const undergradNonTech = aff["Undergraduate Non-Tech Student"] || 0;
  const freelancer = aff["Freelancer / Self-Employed Developer"] || 0;
  const enthusiast = aff["Tech Enthusiast / Career Switcher"] || 0;
  const undergradTechPercent = total ? ((undergradTech / total) * 100).toFixed(1) : "0.0";

  // --- geography (single-select, dynamic label set straight from the sheet) ---
  const cities = apiData.cities || {};
  const sortedCities = Object.entries(cities).sort((a,b) => b[1]-a[1]);
  const geoLabels = sortedCities.map(e => e[0]);
  const geoValues = sortedCities.map(e => e[1]);
  let santaRosa = 0, cabuyao = 0, binan = 0;
  for (const [city, count] of Object.entries(cities)) {
    const l = city.toLowerCase();
    if (l.includes('santa rosa')) santaRosa += count;
    if (l.includes('cabuyao')) cabuyao += count;
    if (l.includes('biñan') || l.includes('binan')) binan += count;
  }
  const mainCitiesTotal = santaRosa + cabuyao;
  const mainCitiesPercent = total ? ((mainCitiesTotal / total) * 100).toFixed(1) : "0.0";

  // --- technical interests (multi-select, now returned pre-split by key) ---
  const ts = apiData.techStacks || {};
  const frontend = ts.frontend || 0, backend = ts.backend || 0, datascience = ts.datascience || 0,
        uiux = ts.uiux || 0, cybersecurity = ts.cybersecurity || 0, mobile = ts.mobile || 0,
        cloud = ts.cloud || 0, projectmgmt = ts.projectmgmt || 0, blockchain = ts.blockchain || 0;
  const frontendPercent = total ? ((frontend / total) * 100).toFixed(1) : "0.0";

  // --- skill levels (single-select) ---
  const skills = apiData.skillLevels || {};
  const lvl1 = skills["1"] || 0, lvl2 = skills["2"] || 0, lvl3 = skills["3"] || 0, lvl4 = skills["4"] || 0, lvl5 = skills["5"] || 0;
  const midLevelCount = lvl2 + lvl3;

  // --- motivations (multi-select, pre-split by key) ---
  const mo = apiData.motivations || {};
  const networking = mo.networking || 0, upskilling = mo.upskilling || 0, mentorship = mo.mentorship || 0,
        civic = mo.civic || 0, hackathons = mo.hackathons || 0;

  // --- volunteer intent (single-select) ---
  const vi = apiData.volunteerInterest || {};
  let volunteerYes = 0, volunteerNo = 0;
  for (const [key, count] of Object.entries(vi)) {
    if (key.toLowerCase().includes('yes')) volunteerYes += count; else volunteerNo += count;
  }
  const volunteerPercent = total ? ((volunteerYes / total) * 100).toFixed(1) : "0.0";

  // --- committees (multi-select, pre-split by key) ---
  const co = apiData.committees || {};
  const program = co.program || 0, tech = co.tech || 0, marketing = co.marketing || 0,
        finance = co.finance || 0, comms = co.comms || 0, partnership = co.partnership || 0;
  const committeeTotal = apiData.committeeRespondents || 0;

  // --- write text into the page ---
  ["total-applicants-1","total-applicants-2","total-applicants-4","total-applicants-5","total-applicants-6"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = total; });

  document.getElementById("stat-undergrad-percent").textContent = `${undergradTechPercent}%`;
  document.getElementById("stat-undergrad-count").textContent = `${undergradTech} / ${total}`;
  document.getElementById("stat-geo-percent").textContent = `${mainCitiesPercent}%`;
  document.getElementById("stat-geo-count").textContent = `${mainCitiesTotal} / ${total}`;
  document.getElementById("stat-frontend-count").textContent = frontend;
  document.getElementById("stat-frontend-percent").textContent = `${frontendPercent}%`;
  document.getElementById("stat-volunteer-percent").textContent = `${volunteerPercent}%`;
  document.getElementById("stat-volunteer-count").textContent = `${volunteerYes} / ${total}`;

  document.getElementById("undergrad-count-2").textContent = undergradTech;
  document.getElementById("bigstat-undergrad-count").textContent = `${undergradTech} / ${total}`;
  document.getElementById("bigstat-undergrad-percent").textContent = `${undergradTechPercent}%`;
  document.getElementById("aff-professional").textContent = employedTech;
  document.getElementById("aff-nontech").textContent = undergradNonTech;
  document.getElementById("aff-freelancer").textContent = freelancer;
  document.getElementById("aff-enthusiast").textContent = enthusiast;

  document.getElementById("geo-text").textContent =
    `Santa Rosa (${santaRosa}) and Cabuyao (${cabuyao}) together account for ${mainCitiesTotal} of ${total} applicants — over ${mainCitiesPercent}% of the cohort. Biñan (${binan}) is a clear third hub; everywhere else is thin.`;

  const avg = total ? (((lvl1*1)+(lvl2*2)+(lvl3*3)+(lvl4*4)+(lvl5*5)) / total).toFixed(1) : "0.0";
  document.getElementById("skill-text-body").textContent =
    `most applicants place themselves at an intermediate level (average rating: ${avg} out of 5, with ${midLevelCount} of ${total} rating themselves 2 or 3) — solid ground for hands-on workshops and hackathons, not introductory "what is a variable" content. ${lvl5 > 0 ? lvl5 + ' applicant(s) rated themselves a 5.' : 'Nobody rated themselves a 5.'}`;

  // --- render learn keywords (open-ended question) ---
  const divEl = document.getElementById("divWordCloud");
  const summaryTextEl = document.getElementById("learnSummaryText");
  
  if (divEl) {
    divEl.innerHTML = ""; // Clear existing words
    const kwData = apiData.learnKeywords || {};
    
    // Non-subject words to filter out
    const ignoreWords = [
      "i'm", "also", "development", "web", "analysis", "i", "want", "learn", "build", 
      "using", "topic", "tool", "framework", "technology", "topics", "tools", 
      "frameworks", "technologies", "would", "like", "use", "create", "make", "some", 
      "more", "how", "knowledge", "skills", "skill", "projects", "project", "things", 
      "etc", "something", "anything", "anyone", "any", "study", "work", "laguna", "cohort",
      "application", "applications", "participant", "participants", "about", "with",
      "but", "it", "in", "at", "on", "of", "for", "to", "and", "or", "the", "a", "an",
      "their", "our", "your", "my", "me", "us", "them", "they", "he", "she", "you", "we"
    ];

    const cleanedKws = {};
    for (const [kw, count] of Object.entries(kwData)) {
      const cleanKw = kw.toLowerCase().trim();
      if (ignoreWords.includes(cleanKw) || cleanKw.length <= 1) continue;
      
      // Merge synonyms to make the summary clean
      let normalized = cleanKw;
      if (cleanKw === 'ui' || cleanKw === 'ux' || cleanKw === 'uiux') {
        normalized = 'ui/ux';
      } else if (cleanKw === 'ml' || cleanKw === 'machine' || cleanKw === 'learning' || cleanKw === 'ai') {
        normalized = 'ai / ML';
      } else if (cleanKw === 'js' || cleanKw === 'javascript') {
        normalized = 'javascript';
      } else if (cleanKw === 'ts' || cleanKw === 'typescript') {
        normalized = 'typescript';
      }
      
      cleanedKws[normalized] = (cleanedKws[normalized] || 0) + count;
    }

    const sortedKws = Object.entries(cleanedKws)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 75); // Limit to top 75 keywords to fill the larger canvas space
      
    if (sortedKws.length > 0) {
      const counts = sortedKws.map(k => k[1]);
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);

      const wordList = sortedKws.map(([kw, count]) => [kw, count]);

      // Call WordCloud2 engine in DOM mode (target element is a div)
      WordCloud(divEl, {
        list: wordList,
        gridSize: 5, // Tighter packing
        weightFactor: function (size) {
          if (maxCount === minCount) return 16;
          // Scale dynamically: biggest word = 56px, smallest = 12px
          return 12 + ((size - minCount) / (maxCount - minCount)) * 44;
        },
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 'bold',
        color: function (word, weight) {
          const w = word.toLowerCase().trim();
          if (w === 'ui/ux') return '#F5A623'; // Amber
          if (w === 'ai / ml' || w === 'ai/ml' || w === 'ai' || w === 'ml') return '#4FD1C5'; // Teal
          if (w === 'cybersecurity') return '#7C6CF0'; // Violet
          return '#EDEFF5'; // White
        },
        classes: function (word, weight) {
          const w = word.toLowerCase().trim();
          if (w === 'ui/ux') return 'glow-amber';
          if (w === 'ai / ml' || w === 'ai/ml' || w === 'ai' || w === 'ml') return 'glow-teal';
          if (w === 'cybersecurity') return 'glow-violet';
          return '';
        },
        rotateRatio: 0.18, // Mostly horizontal to mimic the cloud's flat/wide shape
        rotationSteps: 2, // 0 and 90 degrees
        backgroundColor: 'transparent',
        shape: 'circle',
        ellipticity: 0.45, // Spreads the word cloud wider to fill horizontal gaps
        hover: function (item, dimension, event) {
          const tooltip = document.getElementById('wordcloud-tooltip');
          if (!tooltip) return;
          if (item) {
            const [word, count] = item;
            const w = word.toLowerCase().trim();
            if (w === 'ui/ux' || w === 'ai / ml' || w === 'ai/ml' || w === 'ai' || w === 'ml' || w === 'cybersecurity') {
              tooltip.innerHTML = `<strong>${word.toUpperCase()}</strong>: ${count} applicants`;
              tooltip.style.left = (event.pageX + 15) + 'px';
              tooltip.style.top = (event.pageY + 15) + 'px';
              tooltip.style.display = 'block';
              return;
            }
          }
          tooltip.style.display = 'none';
        }
      });
      
      // Dynamic sophisticated summary
      if (summaryTextEl) {
        const top3 = sortedKws.slice(0, 3).map(k => `<strong>${k[0].toUpperCase()}</strong>`);
        summaryTextEl.innerHTML = `Our cohort shows an overwhelming drive to build and learn in the domains of ${top3.join(', ')}. We should structure our upcoming DEVCON Laguna workshops and civic tech hackathons around these core fields.`;
      }
    } else {
      if (summaryTextEl) summaryTextEl.textContent = "Waiting for live applicant responses to compile topics.";
    }
  }

  document.getElementById("volunteer-count-2").textContent = volunteerYes;
  document.getElementById("volunteer-percent-2").textContent = `${volunteerPercent}%`;
  document.getElementById("bigstat-volunteer-percent").textContent = `${volunteerPercent}%`;
  document.getElementById("bigstat-volunteer-count").textContent = `${volunteerYes} / ${total}`;
  document.getElementById("committee-total-count").textContent = committeeTotal;

  // --- calculate promotional video impact dynamically ---
  const baseline = 48;
  const growth = total - baseline;
  const growthPct = total ? ((growth / baseline) * 100).toFixed(1) : "0.0";
  
  const compTotalEl = document.getElementById("campaign-total-count");
  if (compTotalEl) compTotalEl.textContent = total;
  
  const compNewTextEl = document.getElementById("campaign-new-text");
  if (compNewTextEl) compNewTextEl.textContent = `${growth} new participants`;
  
  const compNewCountEl = document.getElementById("campaign-new-count");
  if (compNewCountEl) compNewCountEl.textContent = `+${growth} Applicants`;
  
  const compGrowthEl = document.getElementById("campaign-growth-rate");
  if (compGrowthEl) compGrowthEl.textContent = `+${growthPct}%`;

  initCharts({
    undergradTech, employedTech, undergradNonTech, freelancer, enthusiast,
    geoLabels, geoValues,
    frontend, backend, datascience, uiux, cybersecurity, mobile, cloud, projectmgmt, blockchain,
    lvl1, lvl2, lvl3, lvl4, lvl5,
    networking, upskilling, mentorship, civic, hackathons,
    volunteerYes, volunteerNo,
    program, tech, marketing, finance, comms, partnership
  });
}

// --- live status indicator ---
function setLiveStatus(state, message) {
  const dot = document.getElementById('liveDot');
  const text = document.getElementById('liveStatusText');
  dot.classList.remove('live','err');
  if (state === 'live') dot.classList.add('live');
  if (state === 'err') dot.classList.add('err');
  text.textContent = message;
}
function relTime(date) {
  const secs = Math.floor((Date.now() - date.getTime())/1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs/60)}m ago`;
}

async function loadLiveData(isManual) {
  const btn = document.getElementById('refreshBtn');
  if (isManual) btn.disabled = true;
  setLiveStatus(hasLoadedOnce ? 'live' : 'loading', isManual ? 'Refreshing…' : 'Syncing…');

  // Cache-busting: append timestamp to query params to bypass browser caching of 302 redirects
  const params = new URLSearchParams({ t: Date.now().toString() });
  if (isManual) params.set('nocache', '1');

  // Fallback if env.js is missing (e.g. on GitHub Pages)
  let apiUrl = 'https://script.google.com/macros/s/AKfycbzatUDjVRI4nEr7-Tlr4dxqxDqsTsVgwa0_qsc5trg8R24ZlTmPolZdniXUJoaOh5jf/exec';
  if (typeof ENV !== 'undefined' && ENV.SHEET_API_URL) {
    apiUrl = ENV.SHEET_API_URL;
  }

  const requestUrl = `${apiUrl}?${params.toString()}`;

  try {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    processAndRender(data);
    lastUpdated = new Date();
    hasLoadedOnce = true;
    setLiveStatus('live', `Live · Updated ${relTime(lastUpdated)}`);
  } catch (err) {
    console.warn('Live data fetch failed:', err);
    if (!hasLoadedOnce) {
      processAndRender(FALLBACK_DATA);
    }
    setLiveStatus('err', hasLoadedOnce
      ? `Sync failed — showing data from ${relTime(lastUpdated)}`
      : 'Live sync unavailable — showing last known snapshot');
  } finally {
    if (isManual) btn.disabled = false;
  }
}

document.getElementById('refreshBtn').addEventListener('click', () => loadLiveData(true));

loadLiveData(false);
setInterval(() => loadLiveData(false), REFRESH_INTERVAL_MS);
setInterval(() => { if (lastUpdated && hasLoadedOnce) setLiveStatus('live', `Live · Updated ${relTime(lastUpdated)}`); }, 15000);
