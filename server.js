'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios').default;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/test', verifyToken);
app.get('/counts', getCounts);
app.get('/history', getHistoricalCounts);

mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', function() {
  console.log('Mongoose is connected')
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
 


// Returns an array of objects containing the bin start date, total email count, and unread email count: [{date: value, total: value, unread: value}]
// Request query should contain one of these strings: 'Last 7 days','Last 30 days', 'Last 12 months', 'All time'. Eg: "/history?Last 7 days"
async function getHistoricalCounts(req, res) {
  try {
    const verified =  await verifyToken(req);

    if(verified) {
      const dateNow = Date.now()/1000; // Seconds elapsed since UNIX epoch to match Gmail API expectation.

      // Frontend must select one of these 4 binOption strings via query when getting history data. Eg: "/history?Last 7 days"
      const binOptions = [{
        binOption: 'Last 7 days',
        binSize: 60*60*24, // 1 day represented in seconds.
        binCount: 7 // 7 days
      },{
        binOption: 'Last 30 days',
        binSize: 60*60*24, // 1 day represented in seconds.
        binCount: 30 // 30 days
      },{
        binOption: 'Last 12 months',
        binSize: 60*60*24 * 30, // 1 month represented in seconds.
        binCount: 12 // 12 months
      },{
        binOption: 'Last 5 years',
        binSize: 60*60*24 * 30, // 1 month represented in seconds.
        binCount: 60 // 60 months
      }]

      // Create date array that represents the bins
      let datesArray = [];
      const selectedBinOption = binOptions.filter(option => option.binOption === req.query.binOption)[0];
      for (let i = 0; i <= selectedBinOption.binCount; i++) {
        datesArray.push(Math.round(dateNow - selectedBinOption.binSize * i));
      }

      // Get email total and unread counts for each bin.
      let binResults = [];
      for (let i = 0; i < datesArray.length - 1; i++) {
        const beforeDate = datesArray[i];
        const afterDate = datesArray[i+1];
        binResults.push(getBinData(verified, beforeDate, afterDate, req));  // Functions in binResults get gmail API data simultaneously.
      }
      
      const values = await Promise.all(binResults);
      res.status(200).send(values);   // Returns array of objects: [{date: value, total: value, unread: value}]

    } else {
      res.status(498).send('Token expired/invalid');
    }

  } catch (e) {
    console.error(e)
    res.status(500).send('Internal server error')
  }

}

async function getBinData(user, beforeDate, afterDate, req) {
  const binResults = {
    date: beforeDate*1000,  // Date is represented as milliseconds since UNIX epoch to match ChartJS timestamps.
    total: await getGMailData(user, `after:${afterDate} before:${beforeDate}`, req),
    unread: await getGMailData(user, `after:${afterDate} before:${beforeDate} is:unread`, req)
  }

  return binResults;
}

async function getGMailData(user, q, req) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?maxResults=25000&q="${q}"`;
  const apiResponse = await axios.get(url, { headers: {"Authorization": req.headers.authorization} });
  return apiResponse.data.resultSizeEstimate;
}

async function getCounts(req, res) {
  try {
    const verified = await verifyToken(req)
    if (verified) {
      const url = `https://gmail.googleapis.com/gmail/v1/users/${verified}/messages?maxResults=1000&q=""`;
      const data = await axios.get(url, { headers: {Authorization: req.headers.authorization} });
      res.status(200).send(`${data.data.resultSizeEstimate}`)
    } else {
      res.status(498).send('Token expired/invalid')
    }
    
  } catch (e) {
    console.error(e)
    res.status(500).send('COUNTS NOT FOUND')
  }
}

async function verifyToken(req) {
  try {
    const id_token = req.headers.authorization.split(' ')[1]
    const check = await axios(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${id_token}`)
    return check.data.email
  } catch (e) {
    return false;
  } 
}