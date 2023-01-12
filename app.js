const express = require("express");
const bodyParser = require("body-parser");
const mongoose=require("mongoose");
const bcrypt=require("bcrypt");
const _ =require("lodash");
const cookieParser = require("cookie-parser");
const sessions = require('express-session');

require('dotenv').config();

const app = express();
const oneDay = 1000 * 60 * 60 * 24;
const MONGODB_URI = process.env.MONGO_URI

app.set('view engine','ejs');

app.use(sessions({
    secret: "<Your_Secret_Key>",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false
}));
app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

var session;

mongoose.connect(MONGODB_URI,{useNewUrlParser:true});
const todoSchema=new mongoose.Schema({
    username:String,
    name:{
        type:String,
        required:[true,"please specify todolist"]
    },
});

const Todolist=mongoose.model("Todolist",todoSchema);

const listSchema=new mongoose.Schema({
    username:String,
    listname:String,
    name:String,
});
const List=mongoose.model("List",listSchema);

const userSchema=new mongoose.Schema({
    firstname:{
        type:String,
        required:[true,"please specify first name"]
    },
    lastname:{
        type:String,
        required:[true,"please specify last name"]
    },
    username:{
        type:String,
        unique:true,
        required:[true,"please specify unique username"]
    },
    password:{
        type:String,
        minlength:6,
        required:[true,"please specify passsword"]
    },
});
const User=mongoose.model("User",userSchema);

let today=new Date();
  const options={ 
    weekday:"long",day:"numeric",month:"long"
  }
let day=_.capitalize(today.toLocaleDateString("en-US",options));

app.get("/signup",(request,response)=>{
    session=request.session;
    session.customlistarray=[{title:"Home",address:"/"}];
    response.render("signup",{username:"guestuser",errorMsg:"",customlistArray:session.customlistarray});
});
app.get("/signin",(request,response)=>{
    session=request.session;
    session.customlistarray=[{title:"Home",address:"/"}];
    if(session.username===undefined){
        response.render("signin",{username:"guestuser",errorMsg:"",customlistArray:session.customlistarray});
    }
});

app.post("/signup",async (request,response)=>{
    session=request.session;
    const {fname,lname,username,password}=request.body;
    if(fname==="" || lname==="" || username==="" || password===""){
        response.render("signup",{username:"guestuser",errorMsg:"Please specify all the fields",customlistArray:session.customlistarray});
    }else if(password.length<6){
        response.render("signup",{username:"guestuser",errorMsg:"Password should be at least 6 characters long",customlistArray:session.customlistarray});
    }else{
        const hashedPassword=await bcrypt.hash(password,10);
        User.findOne({username:username},function(err,userdata){
        if(!err){
            if(!userdata){
                const user=new User({
                    firstname:fname,
                    lastname:lname,
                    username:username,
                    password:hashedPassword,
                });
                user.save();
                response.redirect("/signin");
            }else{
                response.redirect("/signin");
            }
        }else{
            response.send(err);
        }
        });      
    }
}); 

app.post("/signin",(request,response)=>{
    session=request.session;
    const {username,password}=request.body;
    User.findOne({username:username},async function(err,userdata){
        if(!err){
            if(!userdata){
                response.redirect("/signup");
            }else{
                const isPasswordMatched=await bcrypt.compare(password,userdata.password);
                if(isPasswordMatched===true){
                    session.username=username;

                    List.find({username:session.username}).distinct("listname",function(err,customlist){
                        if(customlist.length!==0){
                            customlist.forEach((each)=>{
                                let listitem={
                                    title:each,
                                    address:"/"+each
                                }
                                session.customlistarray.push(listitem);
                            });
                            response.redirect("/");
                        }else{
                            response.redirect("/");
                        }
                    });
                }else{
                    response.render("signin",{username:"guestuser",errorMsg:"Password Incorrect",customlistArray:session.customlistarray});
                } 
            }
        }else{
            response.send(err);
        }
    });
});
app.post("/signout",(request,response)=>{
    session=request.session;
    if(session.username!==""){
        request.session.destroy();
        session.customlistarray.splice(1);
        response.redirect("/");
    }
});

app.get("/", async (request, response) => {
    session=request.session;
    if(session.username===undefined){
        session.customlistarray=[{title:"Home",address:"/"}];
        Todolist.find({username:"guestuser"},function(err,listitems){
            if(listitems.length===0){
                const guest = new Todolist({
                    username: "guestuser",
                    name:"Please Sign In to see your TodoList",
                });
                guest.save();
                listitems.push(first);
                response.render("list",{title:day,newListItems:listitems,username:"guestuser",customlistArray:session.customlistarray});
            }else{
                response.render("list",{title:day,newListItems:listitems,username:"guestuser",customlistArray:session.customlistarray});
            }
        }); 
    }else{
        Todolist.find({username:session.username},function(err,listitems){
            if(listitems.length===0){
                const first = new Todolist({
                    username: session.username,
                    name:"Welcome to your TodoList",
                });
                first.save();
                listitems.push(first);
                response.render("list",{title:day,newListItems:listitems,username:session.username,customlistArray:session.customlistarray});
            }else{
                response.render("list",{title:day,newListItems:listitems,username:session.username,customlistArray:session.customlistarray});
            };
        });
    }
});
app.post("/",async (request,response)=>{
    session=request.session;
    if(session.username===undefined){
        response.redirect("/signin");
    }else{
        const itemName=request.body.newItem;
        const listName=request.body.list;
        if(itemName===""){
            if(listName===day){
                response.redirect("/");
            }else{
                response.redirect("/"+listName);
            } 
        }else{
            if(listName===day){
                const newItem = new Todolist({
                    username:session.username,
                    name:itemName,
                });
                newItem.save();
                response.redirect("/"); 
            }else{
                const customlistitem = new List({
                    username:session.username,
                    listname:listName,
                    name:itemName,
                });
                customlistitem.save();
                response.redirect("/"+listName);
            }
            
        }  
    }  
});

app.get("/:customListname",(request,response)=>{
    session=request.session;
    let listNameInput=_.capitalize(request.params.customListname);
    if(listNameInput==="Signup"){
        response.redirect("/signup");
    }else if(listNameInput==="Signin"){
        response.redirect("/signin");
    }else{
        if(session.username===undefined){
            response.redirect("/signin");
        }else{
            List.find({listname:listNameInput,username:session.username},function(err,foundList){
                if(!err){
                    if(foundList.length===0){
                        const list=new List({
                            username:session.username,
                            listname:listNameInput,
                            name:"Welcome to your Todolist"
                        });
                        list.save();
                        foundList.push(list);
                        const listitem={
                            title:listNameInput,
                            address:"/"+listNameInput,
                        }
                        session.customlistarray.push(listitem);
                        response.render("list",{title:listNameInput,newListItems:foundList,username:session.username,customlistArray:session.customlistarray});
                    }else{
                        response.render("list",{title:listNameInput,newListItems:foundList,username:session.username,customlistArray:session.customlistarray});
                    }
                }else{
                    response.send(err);
                }
            });  
        }   
    }  
});

app.post("/delete",(request,response)=>{
    session=request.session;
    const checkBoxId= request.body.checkbox;
    const listName=request.body.listname;
    if(session.username!==undefined){
        if (listName===day){
            Todolist.findByIdAndRemove(checkBoxId,function(err){
                if(!err){
                    response.redirect("/");
                }
            });
        }else{
            List.findByIdAndRemove(checkBoxId,function(err){
                if(!err){
                    response.redirect("/"+listName);
                }
            });
        } 
    }else{
        response.redirect("/");
    }
    
});

app.listen(process.env.PORT || 3030, () => {
    
});