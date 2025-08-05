const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name:       { type: String, required: true, minlength: 2, maxlength: 64 },
  phone:      { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        // Only allow exactly 10 digits
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit mobile number!`
    }
  },
  location:   { type: String, required: true },
  checkin:    { type: Date,   required: true },
  checkout:   { type: Date,   required: true },
  adults:     { type: Number, required: true, min: 1 },
  children:   { type: Number, default: 0, min: 0 },
  rooms:      { type: Number, required: true, min: 1 },
  totalAmount:{ type: Number, required: true },
  createdAt:  { type: Date,   default: Date.now },
  remark:     { type: String, default: "" }          // <-- Add this line!
});

module.exports = mongoose.model('Booking', bookingSchema);
