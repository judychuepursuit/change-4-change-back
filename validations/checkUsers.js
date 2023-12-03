const checkUser = (req, res, next) => {
    const user = req.user;

    if (user) {
        if (req.body.title) {
            next();
        } else {
            res.status(400).json({ error: "User is required" });
        }
    } else {
        res.status(401).json({ error: "Unauthorized - User not logged in" });
    }
};

const checkBoolean = (req, res, next) => {
    const { is_important } = req.body;

    if (
        is_important == "true" || is_important == true ||
        is_important == "false" || is_important == false ||
        is_important == undefined
    ) {
        next();
    } else {
        res.status(400).json({ error: "is_important must be a boolean value" });
    }
};

module.exports = { 
    checkBoolean, 
    checkUser 
};
