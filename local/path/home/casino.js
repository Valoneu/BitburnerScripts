/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL')
  
  if (ns.getMoneySources().sinceInstall?.casino >= 10e9) {
    ns.tprintf('ERROR: Already banned from the casino!')
    return
  }
  let player = ns.getPlayer()
  // Go to Aevum if we aren't already there
  if (player.city !== 'Aevum' && player.money < 2e5) {
    ns.tprintf('ERROR: Sorry, you need at least 200k to travel to Aevum.');
    return;
  }

  if (player.city !== 'Aevum') {
    ns.tprintf('INFO: Travel to Aevum for the casino.');
    return
  }

  //Are we in Aevum?
  player = ns.getPlayer()
  /*if (player.location !== "Iker Molina Casino" && player.location !== "Travel Agency") {

    ns.printf("You are here:  %s", player.location)
    return
  }*/

  let doc = eval("document");

  // Step 2 Try to start the coin flip game
  const coinflip = find(doc, "//button[contains(text(), 'coin flip')]");
  ns.ui.openTail()
  if (!coinflip) {
    ns.tprintf("ERROR: Go to the casino and rerun the script")
    ns.tprintf("ERROR: The script must click on entering coinflip")
    return;
  }
  //We have officially started!
  ns.printf("Started.  Hold on!  Calulating sequence")
  click(coinflip);
  // Step 3 Find the buttons
  const tails = find(doc, "//button[contains(text(), 'Tail!')]");
  const heads = find(doc, "//button[contains(text(), 'Head!')]");

  //await shash(ns)

  // Click just so we can get the result textbox
  const log = [];

  // Step 4: Click one of the buttons
  for (let i = 0; i < 1024; i++) {
    click(tails);

    const isTails = find(doc, "//p[text() = 'T']");
    const isHeads = find(doc, "//p[text() = 'H']");

    if (isTails) log.push('T');
    else if (isHeads) log.push('H');
    else {
      ns.printf('FAIL: Something went wrong, aborting sequence!');
      return;
    }
    if (i % 200 === 0) await ns.sleep(0);
  }
  //ns.print('Sequence: ' + log.join(''));
  // Step 5: Validate sequence
  for (let i = 0; i < 1024; i++) {
    if (log[i] == 'T') {
      click(tails);
      const isTails = find(doc, "//p[text() = 'T']");
      if (!isTails) {
        ns.tprintf('FAIL: Something went wrong, aborting sequence!');
        return;
      }
    }
    else if (log[i] == 'H') {
      click(heads);
      const isHeads = find(doc, "//p[text() = 'H']");
      if (!isHeads) {
        ns.tprintf('FAIL: Something went wrong, aborting sequence!');
        return;
      }
    }
    else {
      ns.tprintf('FAIL: Something went wrong, aborting sequence!');
      return;
    }

    if (i % 200 === 0) await ns.sleep(0);
  }

  const input = find(doc, "//input[@type='number']");
  if (!input) {
    ns.printf('FAIL: Could not get a hold of the bet amount input!');
    return;
  }
  input.value = 1000000;

  let loops = 0;
  ns.printf("You can do something else now.")
  // Step 5: Execute sequence
  while (true) {
    try {
      if (log[loops % 1024] == 'T') {
        click(tails);
      }
      else if (log[loops % 1024] == 'H') {
        click(heads);
      }

      if (loops % 2000 == 0) {
        await ns.sleep(0)
      }

      loops++;
      if (ns.getMoneySources().sinceInstall.casino >= 10_000_000_000) return;
    }
    catch (e) {
      ns.tprint('FAIL: ' + e);
      return;
    }
  }
}

function find(doc, xpath) { return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }

function click(elem) {
  elem[Object.keys(elem)[1]].onClick({ isTrusted: true });
}