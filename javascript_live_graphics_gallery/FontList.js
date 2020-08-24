rect(5,20,90,100,"cadetblue",4).setAttribute("style","stroke-width:1;stroke:orange")
text(8,25,"Fonts 🦜!","white","font-size:18; text-shadow: 1px 1px 2px black")


var fontnames=["Verdana","Georgia","Arial","Impact","Arial Black","Lucida Grande","Helvetica"]

var string="<div style='font-size:7;color:white'>"
var j

for(j=0;j<fontnames.length;j++) {
   string+="<p style=\"margin-top:0px;margin-bottom:0px;font-family:'"+fontnames[j]+"'\">"+fontnames[j]+"</p>\n"
}

HTMLObject(8,30,100,100,string)

// NAME:🦜Fonts
