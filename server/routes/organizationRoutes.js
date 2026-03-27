const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getRecruiters,
    inviteRecruiter,
    removeRecruiter,
    getOrgJobs
} = require('../controllers/organizationController');

// All routes require authentication + organization role
router.use(protect, authorize('organization'));

router.get('/jobs', getOrgJobs);
router.get('/recruiters', getRecruiters);
router.post('/recruiters/invite', inviteRecruiter);
router.delete('/recruiters/:id', removeRecruiter);

module.exports = router;
