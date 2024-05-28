const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const ejs = require('ejs');
const path = require('path');
const scrapeJobs = require('./scraper/jobScrapper');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

const DATABASE_URL = 'mongodb://127.0.0.1:27017';
const DATABASE_NAME = 'opportunity_finder'; 
const COLLECTION_NAME = 'users';
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const client = await MongoClient.connect(DATABASE_URL);
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const user = await collection.findOne({ username });

        if (user) {
            if (password === user.password) {
                req.session.user = { username: user.username };
                res.redirect('/home');
            } else {
                console.log('Incorrect password');
                res.status(401).send('Incorrect password');
            }
        } else {
            console.log('User not found');
            res.status(401).send('User not found');
        }

        client.close();
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/home', async (req, res) => {
    try {
        const jobData = await scrapeJobs();
        const username = req.session.user ? req.session.user.username : null;
        const userData = await fetchUserData(username);
        
        let googleJobs = [];
        if (userData) {
            googleJobs = filterRecommendedJobs(userData, jobData.googleJobs);
            
        }
  
        res.render('home', { googleJobs, appleJobs: jobData.appleJobs, un: userData ? userData.fullName : null, username });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/dashboard', async (req, res) => {
    try {
        const username = req.session.user ? req.session.user.username : null;
        const user = await fetchUserData(username);
        const appliedJobs = user ? user.appliedJobs : [];
        res.render('dashboard', { appliedJobs });
    } catch (error) {
        console.error('Error fetching applied jobs:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/profile', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/');
        }

        const username = req.session.user.username;
        const userData = await fetchUserData(username);
        
        if (!userData) {
            return res.status(404).send('User data not found');
        }
        
        res.render('profile', { userData });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/update-profile', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/');
        }

        const username = req.session.user.username;
        const updatedUserData = req.body;
        
        const result = await updateUserData(username, updatedUserData); 
        
        if (result.success) {
            res.redirect('/profile');
        } else {
            res.status(500).send(result.message); 
        }
    } catch (error) {
        console.error('Error updating user data:', error);
        res.status(500).send('Internal Server Error');
    }
});


async function updateUserData(username, newData) {
    try {
        const client = await MongoClient.connect(DATABASE_URL); 
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);

        await collection.updateOne({ username: username }, { $set: newData });

        client.close(); 
        return { success: true, message: "User data updated successfully" };
    } catch (error) {
        console.error('Error updating user data:', error);
        return { success: false, message: "Failed to update user data" };
    }
}



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
        } else {
            res.redirect('/');
        }
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { fullName, dob, gender, summary, permanentAddress, currentAddress, institution, programDegree, branch, semester, yopo, previousInstitution, boardUniversity, previousProgramDegree, branchPrevious, educationType, companyName, jobTitle, location, positionType, jobFunction, startDate, endDate, salaryStipendRange, skills, languages, username, password } = req.body;

    try {
        const client = await MongoClient.connect(DATABASE_URL);
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const existingUser = await collection.findOne({ username });

        if (existingUser) {
            res.send('<script>alert("Username already exists. Please choose a different one."); window.location.href = "/register";</script>');
        } else {
            const user = { fullName, dob, gender, summary, permanentAddress, currentAddress, institution, programDegree, branch, semester, yopo, previousInstitution, boardUniversity, previousProgramDegree, branchPrevious, educationType, companyName, jobTitle, location, positionType, jobFunction, startDate, endDate, salaryStipendRange, skills, languages, username, password ,appliedJobs:[]};

            const result = await collection.insertOne(user);

            if (result.insertedCount == 0) {
                console.log('User registered:', result.ops[0]);
                res.send('<script>alert("User registration success."); window.location.href = "/index";</script>');
            } else {
                res.send('<script>alert("User registration success."); window.location.href = "/register";</script>');
            }
        }

        client.close();
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/apply-job', async (req, res) => {
    const { title, loc, absoluteLink } = req.body;
    try {
        const client = await MongoClient.connect(DATABASE_URL);
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const username = req.session.user ? req.session.user.username : null;
        const result = await collection.updateOne(
            { username },
            {
                $push: {
                    appliedJobs: {
                        title: title,
                        location: loc,
                        applyLink: absoluteLink
                    }
                }
            }
        );
        

        if (result.modifiedCount > 0) {
            res.sendStatus(200); 
        } else {
            res.sendStatus(500); 
        }

        client.close();
    } catch (error) {
        console.error('Error applying for job:', error);
        res.sendStatus(500); x
    }
});

async function fetchUserData(username) {
    try {
        const client = await MongoClient.connect(DATABASE_URL);
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);
  
        const userData = await collection.findOne({ username });
  
        client.close();
  
        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

 function filterRecommendedJobs(user_profile, job_descriptions) {
    const recommended_jobs = [];

    if (!user_profile || !user_profile.summary) {
        return recommended_jobs;
    }

    for (const job_description of job_descriptions) {
        const jobTitleLowerCase = job_description.title.toLowerCase();
        const summaryLowerCase = user_profile.summary.toLowerCase();
        if (jobTitleLowerCase.includes(summaryLowerCase)) {
            recommended_jobs.push(job_description);
        } else if (program_degree_matches_minimum_qualifications(user_profile, job_description)) {
            recommended_jobs.push(job_description);
        } else if (skills_match_job_qualifications(user_profile, job_description)) {
            recommended_jobs.push(job_description);
        } else if (graduation_year_conditions(user_profile, job_description)) {
            recommended_jobs.push(job_description);
        }
    }
    return recommended_jobs;
}

function program_degree_matches_minimum_qualifications(user_profile, job_description) {
    const user_program_degree = user_profile.programDegree.toLowerCase();
    const minimum_qualifications = job_description.mq;

    for (const qualification of minimum_qualifications) {
        if (qualification.toLowerCase().includes('program') && qualification.toLowerCase().includes(user_program_degree)) {
            return true;
        }
    }

    return false;
}

function skills_match_job_qualifications(user_profile, job_description) {
    const user_skills = new Set(user_profile.skills.toLowerCase().split(', '));
    const minimum_qualifications = job_description.mq;
    const preferred_qualifications = job_description.pq;

    if (minimum_qualifications.some(skill => user_skills.has(skill.toLowerCase()))) {
        return true;
    } else if (preferred_qualifications.some(skill => user_skills.has(skill.toLowerCase()))) {
        return true;
    }

    return false;
}

function graduation_year_conditions(user_profile, job_description) {
    const current_year = get_current_year();
    const graduation_year = parseInt(user_profile.yopo);
    const minimum_qualifications = job_description.mq;

    if (minimum_qualifications.some(qualification => qualification.toLowerCase().includes(String(graduation_year)))) {
        return true;
    } else if (graduation_year > current_year && minimum_qualifications.includes('currently enrolled')) {
        return true;
    }

    return false;
}

function get_current_year() {
    return new Date().getFullYear();
} 


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
