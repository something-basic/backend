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
app.get('/history', getHistoricalCounts);
app.get('/total', getTotal);
app.post('/total', postTotal);
app.delete('/total', deleteTotal);

mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', function() {
  console.log('Mongoose is connected')
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// Returns an array of objects containing the bin start date, total email count, and unread email count: [{date: 1484195670, total: 456, unread: 123}]
// Request query from frontend should contain one of these strings: 'Last 7 days','Last 30 days', 'Last 12 months', 'All time'. Eg: "/history?binOption=Last 7 days"
async function getHistoricalCounts(req, res) {
  try {
    const verified =  await verifyToken(req);

    if(verified) {
      const dateNow = Date.now()/1000; // Seconds elapsed since UNIX epoch to match Gmail API expectation.

      // Frontend must select one of these 4 binOption strings via query when getting history data. Eg: "/history?binOption=Last 7 days"
      const binOptions = [{
        binOption: 'Last 7 days',
        binSize: 60*60*24, // 1 day represented in seconds
        binCount: 7 // 7 days
      },{
        binOption: 'Last 30 days',
        binSize: 60*60*24, // 1 day represented in seconds
        binCount: 30 // 30 days
      },{
        binOption: 'Last 12 months',
        binSize: 60*60*24 * 30, // 1 month represented in seconds
        binCount: 12 // 12 months
      },{
        binOption: 'Last 5 years',
        binSize: 60*60*24 * 30, // 1 month represented in seconds
        binCount: 60 // 60 months
      }];

      // Create array of dates that represents the bins
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
        binResults.push(getBinData(verified, beforeDate, afterDate, req));  // Get gmail data for each bin simultaneously. Drops query time from ~17s to ~1s for 60 bins.
      }
      
      const values = await Promise.all(binResults);
      res.status(200).send(values);   // Responds with array of objects: [{date: 1484195670, total: 456, unread: 123}]

    } else {
      res.status(498).send('Token expired/invalid');
    }

  } catch (e) {
    console.error(e);
    res.status(500).send('Internal server error');
  }

}

async function getBinData(user, beforeDate, afterDate, req) {
  const total = getGMailData(user, `after:${afterDate} before:${beforeDate} -"unsubscribe"`, req);
  const unread = getGMailData(user, `after:${afterDate} before:${beforeDate} is:unread -"unsubscribe"`, req);

  const counts = await Promise.all([total, unread]);

  const binResults = {
    date: beforeDate*1000,  // Date is represented as milliseconds since UNIX epoch to match ChartJS timestamps.
    total: counts[0],
    unread: counts[1]
  }

  return binResults;  // Returns object, eg: {date: 1484195670, total: 456, unread: 123}
}

async function getGMailData(user, q, req, count = 0) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?maxResults=500&q=${q}`;
  const apiResponse = await axios.get(url, { headers: {"Authorization": req.headers.authorization} });

  // GMail API's resultsSizeEstimate seems to be very unreliable past 500.
  // Workaround is to recursively call getGMailData with the nextPageToken if the results exceed 500.
  // Count keeps track of the accumulated count through the recursions.
  // In case resultsSizeEstimate is otherwise inaccurate, message count comes from counting size of messsages array instead.
  count = apiResponse.data.messages ? apiResponse.data.messages.length + count : count;
  if (apiResponse.data.nextPageToken) {
    const nextPageToken = `${apiResponse.data.nextPageToken}`;
    return getGMailData(user, `${q}&pageToken=${nextPageToken}`, req, count);
  } else {
    return count;
  }
}

async function getTotal(req, res) {
  try {
    const verified =  await verifyToken(req);
    if (verified) {
      let dbUser = await Total.find({user:verified});
      res.status(200).send(dbUser);
    } else {
      res.status(498).send('Token expired/invalid');
    }
  } catch (e) {
        console.error(e);
    res.status(500).send('Internal server error');
  }
}

async function postTotal(req, res) {
  try {
    const verified =  await verifyToken(req);
    if (verified) {
      // get gmail total counts
      const getGmailTotal = getGMailData(verified, '-"unsubscribe"', req);
      const getGmailUnreadTotal = getGMailData(verified, 'is:unread -"unsubscribe"', req);

      const totals = await Promise.all([getGmailTotal, getGmailUnreadTotal]);
      res.status(201).send(totals);
      // store counts in out database
    } else {
      res.status(498).send('Token expired/invalid');
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal server error');
  }
}

async function deleteTotal(req, res) {
  try {
    const verified =  await verifyToken(req);
    if (verified) {

    } else {
      res.status(498).send('Token expired/invalid');
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal server error');
  }
}


async function verifyToken(req) {
  try {
    const id_token = req.headers.authorization.split(' ')[1];
    const check = await axios(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${id_token}`);
    return check.data.email;
  } catch (e) {
    return false;
  } 
}
