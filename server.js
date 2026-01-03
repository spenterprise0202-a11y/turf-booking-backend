const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const app = express();
app.use(cors());
app.use(express.json());

// photo upload
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use('/uploads', express.static('uploads'));


// Slots stored by date
let slotsByDate = {};
let bookings = [];
let bookingIdCounter = 1;
let userProfile = {
  name: '',
  mobile: '',
  email: '',
  address: '',
  avatar: ''
};


// Create default slots for a date
function createSlotsForDate(date) {
  const slots = [];
  let id = 1;

  for (let hour = 0; hour < 24; hour++) {
    const start = formatTime(hour);          // ✅ REQUIRED
    const end = formatTime(hour + 1);        // ✅ REQUIRED

    slots.push({
      id: id++,
      startHour: hour,                       // ⭐ KEY FIX
      endHour: (hour + 1) % 24,
      time: `${start} - ${end}`,
      status: 'AVAILABLE',
      price: getPriceByHour(hour)
    });
  }

  return slots;
}



function formatTime(hour) {
  const h = hour % 24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12.toString().padStart(2, '0')}:00 ${period}`;
}

function getPriceByHour(hour) {
  // Example pricing logic
  if (hour >= 6 && hour < 10) return 800;      // Morning peak
  if (hour >= 16 && hour < 22) return 1200;    // Evening peak
  return 600;                                  // Off-peak
}

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });




// GET slots by date
app.get('/slots', (req, res) => {
  const date = req.query.date;

  if (!slotsByDate[date]) {
    slotsByDate[date] = createSlotsForDate(date);
  }

  res.json(slotsByDate[date]);
});

// BOOK slot
app.post('/book', (req, res) => {
  const { date, id } = req.body;

  if (!slotsByDate[date]) {
    slotsByDate[date] = createSlotsForDate(date);
  }

  const slots = slotsByDate[date];
  const slot = slots.find(s => s.id === id);

  if (!slot || slot.status === 'BOOKED') {
    return res.status(400).json({ message: 'Slot already booked' });
  }

  // Mark slot booked
  slot.status = 'BOOKED';

  // Save booking
  const booking = {
    bookingId: bookingIdCounter++,
    date,
    time: slot.time,
    price: slot.price,
    status: 'CONFIRMED'
  };

  bookings.push(booking);

  res.json({
    message: 'Booked successfully',
    booking
  });
});

app.get('/my-bookings', (req, res) => {
  res.json(bookings);
});

app.post('/cancel-booking', (req, res) => {
  const { bookingId } = req.body;

  const booking = bookings.find(b => b.bookingId === bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (booking.status === 'CANCELLED') {
    return res.status(400).json({ message: 'Already cancelled' });
  }

  booking.status = 'CANCELLED';

  // Make slot AVAILABLE again
  const slots = slotsByDate[booking.date];
  if (slots) {
    const slot = slots.find(s => s.time === booking.time);
    if (slot) {
      slot.status = 'AVAILABLE';
    }
  }

  res.json({ message: 'Booking cancelled successfully' });
});


// SAVE / UPDATE PROFILE
app.post('/profile', upload.single('photo'), (req, res) => {
  const { name, mobile, email, address } = req.body;
  const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

  userProfile = {
    name,
    mobile,
    email,
    address,
    photo: req.file
      ? `${BASE_URL}/uploads/${req.file.filename}`
      : userProfile.photo
  };

  res.json({
    message: 'Profile saved',
    profile: userProfile
  });
});

// GET PROFILE
app.get('/profile', (req, res) => {
  res.json(userProfile);
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
