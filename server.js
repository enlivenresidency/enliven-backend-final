require('dotenv').config();



const express = require('express');

const cors = require('cors');

const mongoose = require('mongoose');

const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');



const Booking = require('./models/booking'); // Adjust path if needed

const User = require('./models/user'); // Adjust path if needed



const app = express();



const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

const nodemailer = require('nodemailer');





const allowedOrigins = [

  process.env.FRONTEND_URL,

  'https://enlivenresidency.com',

  'https://www.enlivenresidency.com',

  'http://localhost:5173',

  'https://hoppscotch.io'

];



app.use(cors({

  origin: function (origin, callback) {

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error('Not allowed by CORS: ' + origin));

  },

  credentials: true,

}));



app.use(cors({

  origin: function (origin, callback) {

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error('Not allowed by CORS: ' + origin));

  },

  credentials: true,

}));



const transporter = nodemailer.createTransport({

  service: 'gmail',

  auth: {

    user: process.env.SMTP_USER,

    pass: process.env.SMTP_PASS,

  },

});

process.on('uncaughtException', (err) => {

  console.error('Uncaught Exception:', err);

});

process.on('unhandledRejection', (reason, promise) => {

  console.error('Unhandled Rejection:', reason);

});



// Connect to MongoDB

mongoose

  .connect(process.env.MONGO_URI)

  .then(() => {

    console.log('MongoDB Connected');



    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {

      console.log(`Backend server running on port ${PORT}`);

    });





  })

  .catch((err) => {

    console.error('MongoDB connection error:', err);

    process.exit(1);

  });





// Middleware















app.use(express.json());

app.use(express.urlencoded({ extended: true }));



// Pricing configuration

const PROPERTY_PRICES = {

  Patia: 1200,

  Niladri: 1500,



};



// Health check endpoint

app.get('/', (req, res) => {

  res.send('Hotel Booking Backend API is running.');

});



/**

 * Authentication and Authorization Middleware

 */



// JWT Authentication middleware

function authenticateToken(req, res, next) {

  const authHeader = req.headers['authorization'];

  const token = authHeader && authHeader.split(' ')[1]; // Extract Bearer token



  if (!token) return res.status(401).json({ error: 'Unauthorized' });



  jwt.verify(token, JWT_SECRET, (err, user) => {

    if (err) return res.status(403).json({ error: 'Forbidden' });

    req.user = user; // Attach user info to request

    next();

  });

}



// Role-based authorization middleware

function authorizeRoles(...roles) {

  return (req, res, next) => {

    if (!req.user || !roles.includes(req.user.role)) {

      return res.status(403).json({ error: 'Forbidden: insufficient rights' });

    }

    next();

  };

}



/**

 * Routes

 */



// User login (returns JWT token and user info)

app.post('/api/login', async (req, res) => {

  const { username, password } = req.body;



  if (!username || !password)

    return res.status(400).json({ error: 'Username and password required' });



  try {

    const user = await User.findOne({ username });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });



    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword)

      return res.status(401).json({ error: 'Invalid credentials' });



    const token = jwt.sign(

      { id: user._id, username: user.username, role: user.role },

      JWT_SECRET,

      { expiresIn: '8h' }

    );



    res.json({

      token,

      role: user.role,

      username: user.username,

    });

  } catch (err) {

    console.error('Login error:', err);

    res.status(500).json({ error: 'Server error during login' });

  }

});



// Booking creation (must be authenticated)

app.post('/api/book', async (req, res) => {

  try {

    const {

      name,

      phone,

      checkin,

      checkout,

      adults,

      children = 0,

      rooms,

      location,

    } = req.body;



    // Validation

    if (

      !name ||

      typeof name !== 'string' ||

      name.trim().length < 2 ||

      name.trim().length > 64

    )

      return res

        .status(400)

        .json({ error: 'Name must be between 2 to 64 characters' });



    const phoneNumber = phone ? phone.replace(/\D/g, '') : '';

    if (!phoneNumber || phoneNumber.length !== 10)

      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });



    if (!checkin || !checkout)

      return res

        .status(400)

        .json({ error: 'Check-in and check-out dates are required' });



    const checkinDate = new Date(checkin);

    const checkoutDate = new Date(checkout);

    const today = new Date();

    today.setHours(0, 0, 0, 0);



    if (isNaN(checkinDate) || isNaN(checkoutDate))

      return res.status(400).json({ error: 'Dates must be valid' });



    if (checkinDate < today)

      return res.status(400).json({ error: 'Check-in date cannot be in the past' });



    if (checkoutDate <= checkinDate)

      return res.status(400).json({ error: 'Check-out date must be after check-in' });



    if (!adults || isNaN(adults) || Number(adults) < 1)

      return res.status(400).json({ error: 'At least one adult must be specified' });



    if (typeof children !== 'undefined' && (isNaN(children) || Number(children) < 0))

      return res

        .status(400)

        .json({ error: 'Number of children must be zero or more' });



    if (!rooms || isNaN(rooms) || Number(rooms) < 1)

      return res.status(400).json({ error: 'At least one room must be specified' });



    if (!location || typeof location !== 'string' || location.trim().length < 2)

      return res.status(400).json({ error: 'Location is required and must be valid' });



    // Calculate pricing

    const bookingPrice = PROPERTY_PRICES[location] || 1200;

    const nights = Math.ceil(

      (checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)

    );

    const roomsCount = Number(rooms);

    const baseAmount = bookingPrice * nights * roomsCount;

    const gst = baseAmount * 0.12;

    const totalAmount = baseAmount + gst;



    // Create and save booking

    const booking = new Booking({

      name: name.trim(),

      phone: phoneNumber,

      checkin: checkinDate,

      checkout: checkoutDate,

      adults: Number(adults),

      children: Number(children),

      rooms: roomsCount,

      location: location.trim(),

      totalAmount,

      // REMARK is NOT set in creation, so will default to ""

    });



    await booking.save();

    const mailOptions = {

      from: process.env.SMTP_USER,

      to: process.env.OWNER_EMAIL,

      subject: 'New Booking Received - Hotel Enliven',

      text: `

New booking received:

Name: ${name}

Phone: ${phone}

Check-in: ${checkin}

Check-out: ${checkout}

Adults: ${adults}

Children: ${children}

Rooms: ${rooms}

Location: ${location}

Total Amount: ₹${totalAmount.toFixed(2)}

      `

    };

    transporter.sendMail(mailOptions, (error, info) => {

      if (error) console.error('Error sending notification email:', error);

    });



    // Respond with success

    res.json({

      success: true,

      message: 'Booking saved successfully',

      bookingPrice,

      nights,

      totalAmount: totalAmount.toFixed(2),

      bookingId: booking._id,

    });

  } catch (error) {

    console.error('Error saving booking:', error);

    res.status(500).json({ error: 'Internal server error' });

  }

});



// Get all bookings (protected, accessible to admin and manager)

app.get('/api/bookings', authenticateToken, async (req, res) => {

  try {

    const bookings = await Booking.find().sort({ createdAt: -1 });

    res.json(bookings);

  } catch (error) {

    console.error('Error fetching bookings:', error);

    res.status(500).json({ error: 'Internal server error' });

  }

});



// Update booking (admin or manager can edit, including remark)

app.put(

  '/api/bookings/:id',

  authenticateToken,

  authorizeRoles('admin'),

  async (req, res) => {

    try {

      const updateData = req.body;

      const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, {

        new: true,

      });

      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      res.json(booking);

    } catch (error) {

      console.error('Error updating booking:', error);

      res.status(500).json({ error: 'Internal server error' });

    }

  }

);



// Delete booking (admin only)

app.delete(

  '/api/bookings/:id',

  authenticateToken,

  authorizeRoles('admin'),

  async (req, res) => {

    try {

      const booking = await Booking.findByIdAndDelete(req.params.id);

      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      res.json({ message: 'Booking deleted successfully' });

    } catch (error) {

      console.error('Error deleting booking:', error);

      res.status(500).json({ error: 'Internal server error' });

    }

  }

);