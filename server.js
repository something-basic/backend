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
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Mongoose is connected')
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));
 

// Front end sends to back end one of these strings: 'Last 7 days','Last 30 days', 'Last 12 months', 'All time'
// Back end calculates the query string array's after and before dates accordingly
async function getHistoricalCounts(req, res) {
  
  const verified =  await verifyToken(req);

  try {

    if(verified) {
      const dateNow = Date.now()/1000; // Gmail API uses seconds elapsed since the UNIX epoch.
      const secondsPerDay = 60*60*24;
      const secondsArray = [];
      for (let i = 0; i <= 7; i++) {
        secondsArray.push(Math.round(dateNow - secondsPerDay * i));
      }
    
      // Get resultsSizeEstimate for each date in array of dates. Range is
      let binResults = [];
      for (let i = 0; i < secondsArray.length - 1; i++) {
        const beforeDate = secondsArray[i];
        const afterDate = secondsArray[i+1];
        //console.log(beforeDate, afterDate);
        binResults.push(getCountInDateRange(verified, beforeDate, afterDate, req));
      }
      
      const values = await Promise.all(binResults);
      console.log(values)

      res.status(200).send(values);   // Returns array of objects: [{date: value, total: value, unread: value},{},{},...,{}]
    } else {
      res.status(404).send('IT NOT WORK  ¯\_(ツ)_/¯ ');
    }

  } catch (e) {
    console.error(e)
    res.status(500).send('HISTORY NOT FOUND')
  }

}

async function getCountInDateRange(user, beforeDate, afterDate, req) {
  console.log(user, beforeDate, afterDate);
  const total = await queryAPI(user, `after:${afterDate} before:${beforeDate}`, req);
  const unread = await queryAPI(user, `after:${afterDate} before:${beforeDate} is:unread`, req);
  
  const dayObj = {
    date: beforeDate*1000,  // ChartJS uses timestamps in milliseconds since UNIX epoch
    total: total,
    unread: unread
  }
  return dayObj;
}

async function queryAPI(user, q, req) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?maxResults=1000&q="${q}"`;
  const apiResponse = await axios.get(url, { headers: {"Authorization": req.headers.authorization} });
  return apiResponse.data.resultSizeEstimate;
}

async function getCounts(req, res) {
  try {
    const verified = await verifyToken(req)
    if (verified) {
      console.log(verified);
      const url = `https://gmail.googleapis.com/gmail/v1/users/${verified}/messages?maxResults=1000&q=""`;
      console.log('hi2')
      const data = await axios.get(url, { headers: {Authorization: req.headers.authorization} });
      console.log(`${data.data.resultSizeEstimate}`)
      res.status(200).send(`${data.data.resultSizeEstimate}`)
    } else {
      res.status(404).send('IT NOT WORK  ¯\_(ツ)_/¯ ')
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