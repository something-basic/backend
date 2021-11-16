'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios').default;
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(process.env.CLIENT_ID);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/test', verifyToken);
app.get('/counts', getHistory);

mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.

once('open', function() {
  console.log('Mongoose is connected')
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));

async function getHistory(req, res) {
  try {
    const verified = await verifyToken(req)
    if (verified) {
      console.log(verified);
      const url = `https://gmail.googleapis.com/gmail/v1/users/${verified}/messages`;
      console.log('hi2')
      const data = await axios.get(url, { headers: {"Authorization": req.headers.authorization} });
      console.log(data.data.resultSizeEstimate)
      res.status(200).send('hi')
    } else {
      res.status(404).send('IT NOT WORK  ¯\_(ツ)_/¯ ')
    }
    
  } catch (e) {
    res.status(500).send('HISTORY NOT FOUND')
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