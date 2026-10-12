const mongoose = require('mongoose');

const therapistSchema = new mongoose.Schema({
  // 1. Profile Photo
  profilePhoto: {
    type: String,
    default: ''
  },
  // 2. Full Name
  name: {
    type: String,
    required: true,
    trim: true
  },
  // 3. Professional Title
  title: {
    type: String,
    required: true,
    trim: true
  },
  // 4. Specialization
  specialization: {
    type: String,
    default: 'Anxiety, Stress & Relationship Therapy',
    trim: true
  },
  // 5. Experience
  experience: {
    type: String,
    required: true,
    default: '6+ Years'
  },
  // 6. Qualification
  qualification: {
    type: String,
    default: 'M.A. Psychology, M.Phil Clinical Psychology'
  },
  // 7. Languages
  languages: {
    type: [String],
    default: ['Hindi', 'English']
  },
  // 8. Session Mode (Online / In-Person / Both)
  sessionMode: {
    type: String,
    default: 'Online / In-Person / Both'
  },
  // 9. About Therapist (3-5 lines introduction)
  about: {
    type: String,
    default: ''
  },
  // 10. Expertise / Treats
  treats: {
    type: [String],
    default: ['Anxiety', 'Stress', 'Depression', 'Relationship Issues']
  },
  // 11. Age Groups
  ageGroups: {
    type: [String],
    default: ['Teenagers', 'Adults', 'Couples']
  },
  // 12. Therapy Methods
  therapyMethods: {
    type: [String],
    default: ['CBT', 'Mindfulness', 'Counseling']
  },
  // 13. Session Duration
  sessionDuration: {
    type: String,
    default: '45–60 Minutes'
  },
  // 14. Availability
  availability: {
    type: String,
    default: 'Mon–Sat, 10 AM–8 PM'
  },
  // 15. Starting Price
  startingPrice: {
    type: String,
    default: '₹499/session'
  },
  pricePerSession: {
    type: Number,
    default: 499
  },
  // 16. Rating
  rating: {
    type: Number,
    default: 4.8
  },
  // 17. Total Sessions
  totalSessions: {
    type: String,
    default: '500+ Sessions Completed'
  },
  // 18. Verified Badge
  isVerified: {
    type: Boolean,
    default: true
  },
  verifiedBadge: {
    type: String,
    default: 'Neuravia Verified'
  },
  // System flags & backwards compatibility
  isActive: {
    type: Boolean,
    default: true
  },
  specialties: {
    type: [String],
    default: []
  },
  bio: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Auto-sync legacy fields before saving
therapistSchema.pre('save', function() {
  if (!this.bio && this.about) {
    this.bio = this.about;
  }
  if ((!this.specialties || this.specialties.length === 0) && this.treats && this.treats.length > 0) {
    this.specialties = this.treats;
  }
  if (!this.about && this.bio) {
    this.about = this.bio;
  }
});

module.exports = mongoose.model('Therapist', therapistSchema);
