const mongoose = require('mongoose');
require('dotenv').config();
const Total = require('./totalModel.js');

async function seed() {
    mongoose.connect(process.env.DB_URL);
    
    const date = Math.round( Math.random() * (1637175454000 - 1542481054000) + 1542481054000);
    const total = Math.round( Math.random() * (1000 - 0) + 0);
    const unread = Math.round( Math.random() * (total - 0) + 0);
    const user = "emfierro2@gmail.com";
    const binOption = "Last 7 days";

    await Total.create({
        user: user,
        history:[{
            date: date,
            total: total,
            unread: unread
        }],
        settings: {
            binOption: binOption
        }
    })

    for (let i = 0; i < 5000; i++) {
        const date = Math.round( Math.random() * (1637175454000 - 1542481054000) + 1542481054000);
        const total = Math.round( Math.random() * (200) + 800);
        const unread = Math.round( Math.random() * (total*0.2) + total*0.4);

        await Total.updateMany({user: user}, {$push:{
            history:{
                date: date,
                total: total,
                unread: unread
            }
        }})
    }

    mongoose.disconnect();
}

seed();
