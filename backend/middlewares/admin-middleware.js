const checkAdmin = async(req, res, next) => {
    try{
        if(req.userInfo.role !== 'admin'){
            return res.status(403).json({
                success: false,
                message: 'Admin permission required'
            })
        }
        next();
    }catch(error){
        res.status(500).json({
            success: false,
            message: 'Internal Server Error here'
        })
    }
}

module.exports = checkAdmin