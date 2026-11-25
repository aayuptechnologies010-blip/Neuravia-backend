const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'main',
    unique: true
  },
  aboutApp: {
    type: String,
    default: 'Neuravia is a dedicated mental well-being platform.\n\n"Where Minds Find Peace"\n\nWe connect users with highly qualified, verified therapists and counselors in a completely safe, private, and confidential environment.'
  },
  termsConditions: {
    type: String,
    default: 'Welcome to Neuravia. By accessing or using our platform, you agree to comply with our Terms & Conditions.\n\n1. Services Overview: Neuravia connects users with verified therapists.\n2. Talk Time & Session Usage: Purchased talk time is decremented based on actual session duration.\n3. Code of Conduct: Respectful behavior is required during all sessions.'
  },
  privacyPolicy: {
    type: String,
    default: 'At Neuravia, we take your personal and call privacy with utmost seriousness.\n\n1. Confidential Calls: Your personal phone number is never shared with therapists.\n2. Data Protection: We never sell or rent your personal data to third parties.'
  }
}, { timestamps: true });

module.exports = mongoose.model('SiteContent', siteContentSchema);
