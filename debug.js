import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

// Load schemas dynamically since we can't easily rely on relative requires without extension resolution
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  role: { type: String, default: 'CANDIDATE' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
});

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);

async function debug() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/procruit');
    console.log('Connected.');
    
    // 1. Get current organization (assume we want to check the first org)
    const orgUser = await User.findOne({ role: 'organization' });
    if (!orgUser) {
        console.log('No org user found.');
        process.exit();
    }
    console.log('Org User:', orgUser._id.toString());
    
    // 2. Find their team
    const teamUsers = await User.find({
        organization: orgUser.organization
    }).select('_id role');
    console.log('Team Users Found:', teamUsers.length);
    
    const teamUserIds = teamUsers.map(u => u._id);
    console.log('Team User IDs:', teamUserIds);
    
    // 3. Find jobs by Team
    const jobs = await Job.find({ postedBy: { $in: teamUserIds } });
    console.log('Jobs Posted By Team:', jobs.length);
    if (jobs.length > 0) {
        console.log(jobs.map(j => ({ id: j._id, title: j.title })));
    }
    
    // 4. Find all jobs just to see who posted them
    const allJobs = await Job.find();
    console.log('All Jobs in DB:', allJobs.length);
    allJobs.forEach(j => {
        console.log(`Job: ${j.title} | postedBy: ${j.postedBy}`);
    });

    process.exit();
}

debug();
