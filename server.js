const express = require("express")
const app = express(
)
app.use(express.json())

app.post("/webhook/pay", (req, res) => {
  const data = req.body 
console.log(data)
  console.log("webhook recived")
  res.sendStatus(200)
 })  
app.get("/webhook/pay", (req, res) => {
  const data = req.body 
console.log(data)
  console.log("webhook recived")
  res.sendStatus(200)
 })  
 app.listen(3000, () => {
  console.log("Server is running on port 3000")
})