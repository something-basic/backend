'use strict';

const mongoose = require('mongoose');

const totalSchema = new mongoose.Schema({
    user: String,
    history:[{
        date: Number,
        total: Number,
        unread: Number
    }],
    settings: {
        binOption: String
    }
});

const Total = mongoose.model('Total', totalSchema);

module.exports = Total;