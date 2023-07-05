const express = require('express');
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://userReadOnly:7ZT817O8ejDfhnBM@minichallenge.q4nve1r.mongodb.net/minichallenge';
const client = new MongoClient(uri);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

// Call the connectToMongoDB function to establish the connection
connectToMongoDB();

const app = express();

// Flight endpoint
app.get('/flight', async (req, res) => {
  const { departureDate, returnDate, destination } = req.query;
  const departureDateFormatted = new Date(departureDate);
  const returnDateFormatted = new Date(returnDate);

  // Validate query parameters
  if (isNaN(departureDateFormatted) || isNaN(returnDateFormatted) || !destination || departureDateFormatted > returnDateFormatted) {
    return res.status(400).json({ error: 'Missing/invalid query parameters.' });
  }

  try {
    const flightsCollection = client.db().collection('flights');

    // Retrieve the cheapest flights from MongoDB based on the query parameters
    const cheapestDeparture = await flightsCollection
      .find({
        date: departureDateFormatted,
        srccity: { $regex: new RegExp("Singapore", 'i') },
        destcity: { $regex: new RegExp(destination, 'i') },
      })
      .sort({ price: 1 })
      .limit(1)
      .toArray();

      const cheapestReturn = await flightsCollection
      .find({
        date: returnDateFormatted,
        srccity: { $regex: new RegExp(destination, 'i') },
        destcity: { $regex: new RegExp("Singapore", 'i') },
      })
      .sort({ price: 1 })
      .limit(1)
      .toArray();

    res.status(200).json(cheapestDeparture.length && cheapestReturn.length ? [{
        "City": destination,
        "Departure Date": departureDate,
        "Departure Airline": cheapestDeparture[0].airlinename,
        "Departure Price": cheapestDeparture[0].price,
        "Return Date": returnDate,
        "Return Airline": cheapestReturn[0].airlinename,
        "Return Price": cheapestReturn[0].price
    }] : []);
  } catch (error) {
    console.error('Error retrieving flights:', error);
    res.status(500).json({ error: 'Error retrieving flights.' });
  }
});

// Hotel endpoint
app.get('/hotel', async (req, res) => {
  const { checkInDate, checkOutDate, destination } = req.query;
  const checkInDateFormatted = new Date(checkInDate);
  const checkOutDateFormatted = new Date(checkOutDate);
  const dayAfterCheckOut = new Date(checkOutDate);
  dayAfterCheckOut.setDate(checkOutDateFormatted.getDate() + 1);
  // Validate query parameters
  if (isNaN(checkInDateFormatted) || isNaN(checkOutDateFormatted) || !destination || checkInDateFormatted > checkOutDateFormatted) {
    return res.status(400).json({ error: 'Missing/invalid query parameters.' });
  }

  try {
    const hotelsCollection = client.db().collection('hotels');
    const hotelPrices = {};
    // Retrieve the cheapest hotels from MongoDB based on the query parameters
    var currentIteration = new Date(checkInDate);
    while (currentIteration.toDateString() !== dayAfterCheckOut.toDateString()) {
        const hotels = await hotelsCollection
        .find({
            date: currentIteration,
            city: { $regex: new RegExp(destination, 'i') },
        })
        .sort({ price: 1 })
        .toArray();
        for (var i = 0; i < hotels.length; i++) {
            const hotel = hotels[i];
            hotelPrices[hotel.hotelName] !== undefined ? hotelPrices[hotel.hotelName] += hotel.price : hotelPrices[hotel.hotelName] = hotel.price;
        };
        currentIteration.setDate(currentIteration.getDate() + 1);
    };
    const sortable = Object.fromEntries(
        Object.entries(hotelPrices).sort(([,a],[,b]) => a-b)
    );
    const cheapestHotel = Object.keys(sortable)[0];
    res.status(200).json(cheapestHotel ? [{
        "City": destination,
        "Check In Date": checkInDate,
        "Check Out Date": checkOutDate,
        "Hotel": cheapestHotel,
        "Price": sortable[cheapestHotel]
    }] : []);
  } catch (error) {
    console.error('Error retrieving hotels:', error);
    res.status(500).json({ error: 'Error retrieving hotels.' });
  }
});

// Start the server
app.listen(8080,'0.0.0.0', () => {
  console.log('Server is running on port 8080.');
});