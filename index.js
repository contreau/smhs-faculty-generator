import fs from "fs";
import path from "path";
import chalk from "chalk";
import promptSync from "prompt-sync";
import { JSDOM } from "jsdom";
import { processRecords } from "./lib/processRecords.js";
import { linkedRow, nullRow } from "./lib/rowTemplates.js";

async function createTables(firstUse) {
  let allHeadshots = [];
  let allEmptyHeadshots = [];
  let headshotCount = 0;
  let emptyHeadshotCount = 0;
  let recordCount = 0;
  let emptyRecords = 0;
  let emptyRecordNames = [];
  let body = "";
  let deleteNonDBEntries = false;
  const prompt = promptSync();
  let pageURL;
  if (firstUse) {
    pageURL = prompt("Provide a valid faculty page URL: ");
  } else {
    pageURL = prompt("Provide another valid faculty page URL: ");
  }
  const DBquestion = prompt(
    "Delete entries that aren't found in the faculty database? (y / n): "
  );
  if (DBquestion === "y") {
    deleteNonDBEntries = true;
  } else {
    deleteNonDBEntries = false;
  }
  const time1 = performance.now();

  // Fetching
  try {
    const response = await fetch(pageURL);
    const html = await response.text();
    const document = new JSDOM(html).window.document;
    const heading = document.querySelector(".page-header").textContent;
    const tables = Array.from(document.querySelectorAll("table")).filter(
      (table) => table.innerHTML.includes("<img")
    );

    // Processing
    for (let i = 0; i < tables.length; i++) {
      const res = await processRecords(tables[i], deleteNonDBEntries);
      const { records, headshots, empty, emptyHeadshots } = res;

      emptyRecords += empty.count;
      emptyRecordNames = [...emptyRecordNames, empty.names];
      headshotCount += headshots.length;
      emptyHeadshotCount += emptyHeadshots.length;
      recordCount += records.length;
      allHeadshots = [...allHeadshots, headshots];
      allEmptyHeadshots = [...allEmptyHeadshots, emptyHeadshots];
      let tableHeading = "";
      if (i > 0) {
        tableHeading = "<h3>Table Heading</h3>";
      }
      let rows = "";
      for (let faculty of records) {
        if (faculty.profileURL === null) {
          const row = new nullRow(faculty.name, faculty.titles);
          rows += row.html;
        } else {
          const row = new linkedRow(
            faculty.name,
            faculty.titles,
            faculty.profileURL,
            faculty.emailURL
          );
          rows += row.html;
        }
      }
      const tableHtml = `
    ${tableHeading}
    <div class="table-responsive">
      <table class="table table-hover table-faculty">
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    `;
      body += tableHtml;
    }
    const time2 = performance.now();
    console.log(
      chalk.hex("#00ff9f").bold(`Processed`),
      recordCount,
      chalk.hex("#00ff9f").bold(`rows in`),
      Math.floor(time2 - time1),
      chalk.hex("#00ff9f").bold(`ms.\n`)
    );

    // File Naming
    const department = `${pageURL.split(".smhs")[0].split("//")[1]}`;
    let htmlFileName;
    if (department === "medicine") {
      const rawText = heading.trim().split(" ");
      rawText.splice(rawText.indexOf(rawText.at(-1)), 1);
      htmlFileName = "medicine-" + rawText.join("");
    } else {
      htmlFileName = department;
    }

    // Combine + Write to File
    const finalHtml = `
  <!--
  Faculty with Headshots (${headshotCount})
  --
  ${allHeadshots}
  --
  -->

  <!--
  Faculty with Headshots MISSING from Database (${emptyHeadshotCount})
  --
  ${allEmptyHeadshots}
  --
  -->

  <!--
  Faculty missing from Database (${emptyRecords})
  Removed from HTML - ${deleteNonDBEntries}
  --
  ${emptyRecordNames} 
  --
  -->
  ${body}`;
    fs.writeFileSync(
      path.join("./html", `${htmlFileName}-faculty-table.html`),
      finalHtml,
      (error) => {
        error ? console.error(error) : true;
      }
    );
    console.log(
      chalk.hex("#ff5722").bold(`Created ${htmlFileName}-faculty-table.html\n`)
    );
    createTables(false);
  } catch (e) {
    console.clear();
    console.log(chalk.hex("#fc3434").bold("Invalid URL."));
    createTables(false);
  }
}

createTables(true);
