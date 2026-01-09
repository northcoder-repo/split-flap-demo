/*
  Split-flap display emulation.
  https://en.wikipedia.org/wiki/Split-flap_display

  Fakes a flap flipping by displaying the top half of
  a letter slightly before the lower half.

  Inspired by these two examples:

   - https://gist.github.com/veltman/f2b2a06d4ffa62f4d39d5ebac5ceeef0
   - https://github.com/paulcuth/departure-board

*/

const msgFontSize = '20px';

/* gap between bottom and    */
/* top halves of glyphs      */
/* set to 'none' for no gap, */
/* or a valid CSS value      */
/* ('2px', '5%', etc.)       */
const glyphSplitGap = '1px';

// speed of transitions (in milliseconds):
const flapPause = 60; // top half of glyph to bottom half
const glyphPause = 180; // pause between glyph sequence
const cascade = 90; // speed of flow from one cell to next

const maxMessageLength = 500;

// show a gap between top and 
// bottom halves of glyphs:
const letterGap = true;

let message = '';
// any char in the message which is not in the `characters`
// list must be replaced by a character which is in the list,
// otherwise the search for a match would never end.
const replacementChar = '☒';

// All the valid characters which can be displayed:
const characters = ' ' // space character (should be first in list!)
    + '1234567890' 
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' // uppercase only!
    + ',.?;:/\'"!&()-’'
    //+ '@#$%^_[{]}=+|~*' // less commmonly used
    + replacementChar; // Do not remove (must be last in list!)

// ------------------- s e t - u p ------------------------- //

// build a rectangular display grid matching the shape
// of the message to be displayed (as wide as the longest
// line in the message).

function createDisplayLine(lineDiv, charsPerLine) {
  for (let i = 0; i < charsPerLine; i++) {
    const glyphDiv = document.createElement("div");
    glyphDiv.classList.add("display-cell");

    const top = document.createElement("div");
    top.classList.add("glyph-top");
    top.textContent = "\u00A0"; // non-breaking space
    glyphDiv.appendChild(top);

    const bottom = document.createElement("div");
    if (glyphSplitGap && glyphSplitGap !== 'none') {
      bottom.classList.add("glyph-bottom", "glyph-split-gap");
    } else {
      bottom.classList.add("glyph-bottom"); // no gap!
    }
    bottom.textContent = "\u00A0"; // non-breaking space
    glyphDiv.appendChild(bottom);

    lineDiv.appendChild(glyphDiv);
  }
}

function reformatMsg(lines, charsPerLine) {
  // fit the message to the display grid by
  // padding lines as needed; replace symbols 
  // not in `characters` - otherwise the loop 
  // would never end...
  const paddedLines = lines.map(line => {
    return line.toUpperCase().padEnd(charsPerLine);
  });
  const paddedString = paddedLines.join("");

  const charSet = new Set(characters);
  let cleanString = "";
  for (const chr of paddedString) {
    cleanString += (charSet.has(chr)) ? chr : replacementChar;
  }
  return cleanString;
}

function prepareGrid() {
  const txtArea = document.getElementById("message");
  const txtAreaMsg = txtArea.value;

  const lines = txtAreaMsg.split(/\r?\n/);
  const lineCount = lines.length;
  const charsPerLine = Math.max(...lines.map(s => s.length));

  const container = document.getElementById("display-container");
  container.replaceChildren(); // clear previous display

  for (line of lines) {
    const lineDiv = document.createElement("div");
    lineDiv.classList.add("display-line");
    container.appendChild(lineDiv);
    createDisplayLine(lineDiv, charsPerLine)
  }
  container.style.display = 'block'; // show empty container

  message = reformatMsg(lines, charsPerLine);
}

// ---------- d i s p l a y   h a n d l i n g ------------------ //

// array of `processCell` functions - one per display cell
const funcsArray = [];

// array of parameters - one for each `processCell` function:
const paramsArray = [];

function displayMessage() {
  // Take our array of async functions and generate promises
  // for each one. Each function is given the parameters
  // it needs for controlling one cell in the display grid. 
  const cellTasks = funcsArray.map((func, index) => {
    return func(paramsArray[index]);
  });

  (async () => {
    try {
      // fire off all the promises and wait for them to complete:
      const results = await Promise.all(cellTasks);
      console.log("All tasks completed. Results:", results);
    } catch (error) {
      console.error("One of the tasks failed:", error);
    } finally {
        cleanUp();
    }
  })();
}

function cleanUp() {
  funcsArray.length = 0;
  paramsArray.length = 0;
  message = '';
  document.getElementById("run").disabled = false;
}

const processCell = async (data) => {
  // spread out the start of cell processing, over time:
  await new Promise(resolve => setTimeout(resolve, data.idx * cascade));

  const glyphTop = data.ele.querySelector(".glyph-top");
  const glyphBot = data.ele.querySelector(".glyph-bottom");
  const tgtGlyph = data.tgt; // from the message
  const chars = [...data.chars];
  let curGlyph = glyphTop.textContent; // currently displayed

  // cycle through array of glyphs until we hit the glyph
  // matching the glyph in the message.
  while(curGlyph !== tgtGlyph && chars.length != 0) {
    glyphTop.textContent = chars[0];
    // pause before changing bottom half of cell display:
    await new Promise(resolve => setTimeout(resolve, flapPause));
    glyphBot.textContent = chars[0];
    curGlyph = glyphTop.textContent;
    // pause before re-checking the cell against the message:
    await new Promise(resolve => setTimeout(resolve, glyphPause));
    chars.shift(); // discard first letter in chars array
  }
  return data.idx;
};

function loadFuncArray() {
  const displayCells = document.getElementsByClassName("display-cell");
  for (let i = 0; i < message.length; i++) {
    // one function per display cell:
    funcsArray.push(processCell);
    // each parameter object targets one
    // specific display cell:
    paramsArray.push({
      idx: i, 
      ele: displayCells[i],
      tgt: message[i],
      chars: characters
    });
  }
}

// ------------- e n t r y   p o i n t ----------------------- //

window.onload = function() {
  const root = document.documentElement;
  root.style.setProperty('--msg-font-size', msgFontSize);
  root.style.setProperty('--glyph-split-gap', glyphSplitGap);

  const btn = document.getElementById("run");
  btn.addEventListener("click", doWork);
};

function doWork() {
  document.getElementById("run").disabled = true;
  prepareGrid();
  loadFuncArray();
  displayMessage();
}
