// 3d-type gradient

var grad
grad=add("radialGradient","fx",0.3,"fy",0.2)

grad.innerHTML="<stop offset='5%' stop-color='rgba(255,255,255,0.8)' /> <stop offset='20%' stop-color='rgba(255,255,0,0.5)' /> <stop offset='70%' stop-color='rgba(255,0,0,0.5)' /> <stop offset='90%' stop-color='black' />"
grad.setAttribute("id","mygrad")

var N=200
var j,r,g,b,x,y,radius
var WIDTH=100
var HEIGHT=100

for(j=1;j<=N;j++) {
  r=Math.random()*255
  g=Math.random()*255
  b=Math.random()*255
  x=Math.random()*WIDTH
  y=Math.random()*HEIGHT
  radius=Math.random()*20
  circle(x,y,radius, "url('#mygrad')")
}

// NAME:🌎Many
