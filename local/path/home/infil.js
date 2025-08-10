/*
Maintainer:
Discord: Sphyxis

Contributer:
Discord: Dihelvid
--Props for the simple "I Win" exploit
--Added args to allow for auto auto infiltrate ;)

*/

const argsSchema = [
  ["single", false],
  ["stop", false],
  ["status", false],
  ["quiet", false],
  ["auto", false],
  ["faction", ''],
  ["update", false],
  ["company", ''],
  ['time', 60000]
]

export function autocomplete(data, args) {
  data.flags(argsSchema);
  return [];
}

//important parameters: "--auto" for auto replay, "--faction BitRunners" for auto-accepting reputation for named faction

const state = {
  // Name of the company that's infiltrated.
  company: "",

  // A copy of company, used for auto-restart so it doesn't get reset at end
  lastCompany: "",

  // Whether infiltration started. False means, we're
  // waiting to arrive on the infiltration screen.
  started: false,

  // Details/state of the current mini game.
  // Is reset after every game.
  game: {},
};

// automatically accept reward and re-run for the same company
let auto = false


// auto-accept reputation for faction instead of money
let repFaction = ''


// Speed of game actions, in milliseconds.
const speed = 50;

// Time infiltration(s)
let infiltrationStart = 0

// Small hack to save RAM.
// This will work smoothly, because the script does not use
// any "ns" functions, it's a pure browser automation tool.
const wnd = eval("window");
const doc = wnd["document"];

// List of all games and an automated solver.
const infiltrationGames = [
  { name: "type it backward" },
  { name: "type it" },
  { name: "enter the code" },
  { name: "close the brackets" },
  { name: 'attack after the sentinel drops his guard and is distracted' },
  { name: "say something nice about the guard" },
  { name: "remember all the mines" },
  { name: "mark all the mines" },
  { name: "match the symbols" },
  { name: "cut the wires with the following properties" },
];

let postTimeout = null

/** @param {NS} ns **/
export async function main(ns) {
  const args = ns.flags(argsSchema);
  auto = args.auto
  repFaction = args.faction

  function print(msg) {
    if (!args.quiet) {
      ns.tprint(`\n${msg}\n`);
    }
  }

  if (args.status) {
    if (wnd.tmrAutoInf) {
      print("Automated infiltration is active");
    } else {
      print("Automated infiltration is inactive");
    }
    return;
  }

  if (wnd.tmrAutoInf) {
    print("Stopping automated infiltration...");
    clearInterval(wnd.tmrAutoInf);
    delete wnd.tmrAutoInf;
    ns.clearPort(30);
    ns.writePort(1, 1);
    if (!args.update) return;
  }

  if (args.stop) {
    setTimeout(() => {
      var btn = Array.from(doc.querySelectorAll('button')).find(x => x.innerText.includes('Cancel'))
      if (btn) btn[Object.keys(btn)[1]].onClick({ isTrusted: true })
    }, 1000)
    return;
  }

  auto = args.auto

  repFaction = args.faction && args.faction.length && args.faction

  print(
    "Automated infiltration is enabled...\nWhen you visit the infiltration screen of any company, all tasks are completed automatically. " +
    `Auto? ${auto} ` +
    `Faction or Money? ${repFaction || 'MONEY'}`
  );
  ns.writePort(30, ns.pid)
  endInfiltration();

  // Monitor the current screen and start infiltration once a
  // valid screen is detected.
  wnd.tmrAutoInf = setInterval(infLoop, speed);

  // If company is set goto company and start infiltration
  if (args.company) {
    state.lastCompany = args.company
    postTimeout = setTimeout(() => {
      postTimeout = null
      var btn = Array.from(doc.querySelectorAll('button')).find(x => x.innerText.indexOf('Infiltrate Company') >= 0)
      if (btn) btn[Object.keys(btn)[1]].onClick({ isTrusted: true })
    }, 1000)
  }
}



/**
 * The infiltration loop, which is called at a rapid interval
 */
function infLoop() {
  if (!state.started) {
    waitForStart();
  } else {
    playGame();
  }
}

/**
 * Returns a list of DOM elements from the main game
 * container.
 */
function getEl(parent, selector) {
  let prefix = ":scope";

  if ("string" === typeof parent) {
    selector = parent;
    parent = doc;

    prefix = ".MuiBox-root>.MuiBox-root>.MuiBox-root";

    if (!doc.querySelectorAll(prefix).length) {
      prefix = ".MuiBox-root>.MuiBox-root>.MuiGrid-root";
    }
    if (!doc.querySelectorAll(prefix).length) {
      prefix = ".MuiContainer-root>.MuiPaper-root";
    }
    if (!doc.querySelectorAll(prefix).length) {
      return [];
    }
  }

  selector = selector.split(",");
  selector = selector.map((item) => `${prefix} ${item}`);
  selector = selector.join(",");

  return parent.querySelectorAll(selector);
}

/**
 * Returns the first element with matching text content.
 */
function filterByText(elements, text) {
  text = text.toLowerCase();

  for (let i = 0; i < elements.length; i++) {
    const content = elements[i].textContent.toLowerCase();

    if (-1 !== content.indexOf(text)) {
      return elements[i];
    }
  }

  return null;
}

/**
 * Reset the state after infiltration is done.
 */
function endInfiltration() {
  state.company = "";
  state.started = false;
  // cancelMyTimeout()
  // acceptMoney() // TODO: needed?
}

/**
 * Simulate wining a minigame. Tells the minigame you won. (Exploit)
 */
function winGame() {
  const screen = doc.querySelectorAll(".MuiContainer-root")[0]
  const state = screen[Object.keys(screen).find(k => k.startsWith("__reactFiber$"))]
  for (const child of state.memoizedProps.children) {
    if (child.props.onSuccess) {
      child.props.onSuccess()
      break
    }
  }
}

/**
 * Infiltration monitor to start automatic infiltration.
 *
 * This function runs asynchronously, after the "main" function ended,
 * so we cannot use any "ns" function here!
 */
function waitForStart() {
  if (state.started) {
    return;
  }

  const h4 = getEl("h4");

  if (!h4.length) {
    return;
  }
  const title = h4[0].textContent;
  if (0 !== title.indexOf("Infiltrating")) {
    return;
  }

  const btnStart = filterByText(getEl("button"), "Start");
  if (!btnStart) {
    return;
  }

  state.company = title.substr(13);
  state.lastCompany = title.substr(13);
  state.started = true;

  var datetime = new Date().today() + " @ " + new Date().timeNow();
  console.log(datetime, " Start automatic infiltration of", state.company);
  btnStart.click();
}

/**
 * Identify the current infiltration game and win it.
 */
function playGame() {
  const screens = doc.querySelectorAll(".MuiContainer-root");
  wnd.info = { screens }

  if (!screens.length) {
    wnd.info = { screens, messge: 'no screens.length, calling endInfiltration()' }
    endInfiltration();
    //refillhealth();
    selectCompany();
    return;
  }
  if (screens[0].children.length < 3) {
    wnd.info = { screens, message: 'screens.children.length < 3, calling endInfiltration()' }
    if (!postTimeout && screens[0].children[1].children[0].innerText === 'Infiltration successful!') {
      acceptMoney('spam') // I think this is spamming, yes, need to check for infiltration complete, but where
    }
    return;
  }

  const screen = screens[0].children[2];
  const h4 = screen.children//getEl(screen, "h4");

  if (!h4.length) {
    wnd.info = { screens, message: 'no h4.length, calling endInfiltration()' }
    endInfiltration();
    return;
  }

  cancelMyTimeout()

  const title = h4[0].textContent.trim().toLowerCase().split(/[!.(]/)[0];
  wnd.info = { screens, message: 'searching for something', title }

  if ("infiltration successful" === title) {
    // NOTE: I get screens.length < 3 on success, not this...
    wnd.info = { screens, message: 'infiltration successful!' }
    endInfiltration();
    return;
  } else {
    wnd.last_title = title
  }

  if ("get ready" === title) {
    if (!infiltrationStart) infiltrationStart = new Date().valueOf()
    return;
  }

  const game = infiltrationGames.find((game) => game.name === title);
  wnd.STATE = { game, screen, h4, title }

  if (game) {
    winGame() // Tells screen you won
  } else {
    console.error("Unknown game:", title);
  }
}

/*================================================================================
  = Auto Mode
  ================================================================================*/

/**
 * Select a company and begin infiltration for auto mode
 */
function selectCompany() {
  if (!auto) return
  cancelMyTimeout()

  postTimeout = setTimeout(() => {
    postTimeout = null

    var selector = 'span[aria-label="' + state.lastCompany + '"]'
    var companyEle = doc.querySelector(selector)
    if (companyEle) {
      if (infiltrationStart) {
        console.info(`FAILED INFILTRATION - ${((new Date().valueOf() - infiltrationStart) / 1000).toFixed(1)} sec, last was ${last_title}`);
        infiltrationStart = 0
      }
      companyEle.click()
      postTimeout = setTimeout(() => {
        postTimeout = null
        var btn = Array.from(doc.querySelectorAll('button')).find(x => x.innerText.indexOf('Infiltrate Company') >= 0)
        if (btn) btn[Object.keys(btn)[1]].onClick({ isTrusted: true })
      }, 1000)
    }
  }, 1000)
}

// accept money bonus, hand off to acceptReputation() if repFaction is set
function acceptMoney(msg) {
  if (!auto) return
  if (postTimeout) return

  //console.log('acceptMoney:', msg)
  cancelMyTimeout()

  if (repFaction && repFaction.length) {
    console.log("starting function accept reputation");
    acceptReputation()
    return
  }

  postTimeout = setTimeout(() => {
    //console.log('acceptMoney()', msg)
    cancelMyTimeout()
    var btn = Array.from(doc.querySelectorAll('button')).find(x => x.innerText.indexOf('Sell for') >= 0)
    if (btn) {
      if (infiltrationStart) {
        console.info(`SUCCESSFUL INFILTRATION - ${((new Date().valueOf() - infiltrationStart) / 1000).toFixed(1)} sec: ${btn.innerText}`);
        infiltrationStart = 0
      }
      btn[Object.keys(btn)[1]].onClick({ isTrusted: true })
    } else {
      console.log(`Failure!  ${ms}`)
    }
    //refillhealth();
    selectCompany();
  }, 1000)
}

// accept reputation bonus
function acceptReputation() {
  cancelMyTimeout()

  postTimeout = setTimeout(() => {
    postTimeout = null

    // var e = Array.from(doc.querySelectorAll('[role="button"]')).find(x => x.innerText.indexOf('None') >= 0);
    var e = Array.from(doc.querySelectorAll('[role="combobox"]')).find(x => x.innerText.indexOf('none') >= 0);
    if (typeof (e) == 'undefined') {
      var e = Array.from(doc.querySelectorAll('[role="combobox"]')).find(x => x.innerText.indexOf(repFaction) >= 0);
    }
    // var datetime = new Date().today() + " @ " + new Date().timeNow();
    // console.log(datetime, " function acceptReputation: e ",e);
    // console.log(datetime, " function acceptReputation: repFaction ", repFaction);
    if (e) {
      e[Object.keys(e)[1]].onKeyDown(new KeyboardEvent('keydown', { 'key': ' ' }));
      postTimeout = setTimeout(() => {
        var e2 = Array.from(doc.querySelectorAll('li[role="option"]')).find(x => x.innerText.indexOf(repFaction) >= 0)
        // console.log("function acceptReputation: e2 ", e2);
        e2.click()
        postTimeout = setTimeout(() => {
          var btn = Array.from(doc.querySelectorAll('button')).find(x => x.innerText.indexOf('Trade for') >= 0)
          // console.log("function acceptReputation: btn ",btn);
          if (btn) {
            btn[Object.keys(btn)[1]].onClick({ isTrusted: true })
            if (infiltrationStart) {
              console.info(`SUCCESSFUL INFILTRATION - ${((new Date().valueOf() - infiltrationStart) / 1000).toFixed(1)} sec - ${btn.innerText}`, repFaction);
              infiltrationStart = 0
            }
          }
        })
      }, 1000)
    }
  }, 1000)
}


// For todays date;
Date.prototype.today = function () {
  return ((this.getDate() < 10) ? "0" : "") + this.getDate() + "/" + (((this.getMonth() + 1) < 10) ? "0" : "") + (this.getMonth() + 1) + "/" + this.getFullYear();
}

// For the time now
Date.prototype.timeNow = function () {
  return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
}

function cancelMyTimeout() {
  if (postTimeout) {
    clearTimeout(postTimeout)
    postTimeout = null
  }
}