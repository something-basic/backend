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
  
  const verified = verifyToken(req);
  // Make array of dates
  try {
    
    if(verified) {
      const dateNow = Date.now(); // A Number representing the milliseconds elapsed since the UNIX epoch.
      const millisecondsPerDay = 1000*60*60*24;
      const millisecondsArray = [];
      for (let i = 0; i < 7; i++) {
        millisecondsArray.push(dateNow - millisecondsPerDay);
      }
      
      // Google API expects seconds from UNIX epoch. Convert from milliseconds to seconds.
      const secondsArray = millisecondsArray.map( date => date/1000 );
    
      // Get resultsSizeEstimate for each date in array of dates. Range is
      // const countsArray = [];
      // for (let i = 0; i < millisecondsArray.length - 1; i++) {
      //   const startDate = millisecondsArray[i];
      //   const endDate = millisecondsArray[i+1];
      //   getCountInDateRange(user, startDate, endDate);
      // }
      
      const values = await Promise.all([getCountInDateRange(user, secondsArray[6], secondsArray[5]), getCountInDateRange(user, secondsArray[5], secondsArray[4])]);
    
      // Return: [{date: value, total: value, unread: value},{},{},...,{}]
      return values;
    } else {
      res.status(404).send('IT NOT WORK  ¯\_(ツ)_/¯ ');
    }

  } catch (e) {
    console.error(e)
    res.status(500).send('HISTORY NOT FOUND')
  }

}

async function getCountInDateRange(user, startDate, endDate) {
  const dayObj = {
    date: startDate,
    total: await queryAPI(user, `after:${startDate} before:${endDate}`),
    unread: await queryAPI(user, `after:${startDate} before:${endDate} is:unread`)
  }
  return dayObj;
}

async function queryAPI(user, q) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?maxResults=1000&q="${q}"`;
  const apiResponse = await axios.get(url, { headers: {"Authorization": req.headers.authorization} });
  return apiResponse.data.resultsSizeEstimate;
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