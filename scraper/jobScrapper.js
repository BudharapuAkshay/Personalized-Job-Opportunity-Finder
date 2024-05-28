// jobScrapper.js
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function scrapeJobs() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const googleJobData=[]
  try {

      await page.goto("https://www.google.com/about/careers/applications/jobs/results/?target_level=INTERN_AND_APPRENTICE&target_level=EARLY&q=2024", { waitUntil: 'domcontentloaded' });
    const googleJobElements = await page.$$('html > body > c-wiz > div > div:nth-child(2) > div > div > div:nth-child(2) > main > div > c-wiz > div > ul > li');
                                      
   

    for (const jobElement of googleJobElements) {
      const jobTitle = await jobElement.$eval(
        'div > div > div:nth-child(1) > div > div:nth-child(1) > div > h3',
        element => element.textContent.trim()
      );

      const location = await jobElement.$eval(
        'div > div > div:nth-child(1) > div > div:nth-child(2) > div > span:nth-child(2) > span',
        element => element.textContent.trim()
      );

      const details = await jobElement.$eval(
        'div > div > div:nth-child(1) > div > div:nth-child(4) > ul > li',
        element => element.textContent.trim()
      );

      const applyLink = await jobElement.$eval(
        'div > div > div:nth-child(1) > div > div:nth-child(5) > div > a',
        element => element.getAttribute('href')
      );

      const href="https://www.google.com/about/careers/applications/"+applyLink;
      const page = await browser.newPage();
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      
      
      const mqItems = await page.$x('/html/body/c-wiz[1]/div/div[2]/div/div/div[2]/main/div/c-wiz/div/div/div/span/div/div[4]/ul[1]/li');

      const mq = [];

      for (const listItem of mqItems) {
        const textContent = await listItem.evaluate(node => node.textContent.trim());
        mq.push(textContent);
      }

      
                                       
      const pqItems = await page.$x('/html/body/c-wiz[1]/div/div[2]/div/div/div[2]/main/div/c-wiz/div/div/div/span/div/div[4]/ul[2]/li');
      const pq = [];
      for (const listItem of pqItems) {
          const textContent = await listItem.evaluate(node => node.textContent.trim());
          pq.push(textContent);
            }
            
            googleJobData.push({
              title: jobTitle,
              loc: location,
              det: details,
              link: applyLink,
              mq: mq,
              pq: pq
            });
    }

    await page.goto('https://jobs.apple.com/en-in/search?team=Internships-STDNT-INTRN', {
      waitUntil: 'domcontentloaded',
    });

    const entirePageHTML = await page.content();

    const $ = cheerio.load(entirePageHTML);
 
    const appleJobData = [];
    
    $('tbody').each(async (index, trElement) => {
      const $tr = $(trElement);
      const title = $tr.find('.table-col-1 > a.table--advanced-search__title').text().trim();
      const location = $tr.find('.table-col-2 > span').text().trim();
      const applyLink = $tr.find('.table-col-1 > a').attr('href').trim();
      const href = "https://jobs.apple.com" + applyLink;
      
    
  appleJobData.push({ title, location, applyLink });
  
});

    
   

    return { googleJobs: googleJobData, appleJobs: appleJobData };
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error; 
  } finally {
    await browser.close();
  }
}


module.exports = scrapeJobs;
