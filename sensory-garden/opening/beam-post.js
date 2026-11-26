export const beamPostShader=`
uniform sampler2D sceneDepth;
uniform mat4 beamProjectionInverse,beamCameraWorld;
uniform vec3 beamSource,beamAxis,beamCenter,beamTint;
uniform float beamLength,beamRadius,beamBound;
float whiteBeamVolume(vec2 uv){
 vec3 eye=beamCameraWorld[3].xyz;
 vec4 rayView=beamProjectionInverse*vec4(uv*2.-1.,-1.,1.);rayView/=rayView.w;
 vec3 rd=normalize((beamCameraWorld*vec4(rayView.xyz,0.)).xyz);
 vec4 hitView=beamProjectionInverse*vec4(uv*2.-1.,texture2D(sceneDepth,uv).r*2.-1.,1.);hitView/=hitView.w;
 float maxDistance=length(hitView.xyz);vec3 oc=eye-beamCenter;
 float b=dot(oc,rd),h=b*b-dot(oc,oc)+beamBound*beamBound;if(h<0.)return 0.;h=sqrt(h);
 float nearT=max(0.,-b-h),farT=min(-b+h,maxDistance);if(farT<=nearT)return 0.;
 float stepSize=(farT-nearT)/28.,optical=0.;
 vec3 U=normalize(cross(beamAxis,vec3(0.,0.,1.))),V=normalize(cross(beamAxis,U));
 for(int i=0;i<28;i++){
  vec3 p=eye+rd*(nearT+(float(i)+.5)*stepSize),rel=p-beamSource;
  float t=dot(rel,beamAxis)/beamLength;
  if(t>0.&&t<1.){vec3 radial=rel-beamAxis*t*beamLength;float r=mix(.09,beamRadius,t),q=length(radial)/r;
   float density=pow(max(0.,1.-q*q),1.1);
   // Fixed angular lanes fan out from one origin, like the reference light shaft.
   float lane=dot(radial,U)/r;
   float strands=.20+.85*exp(-pow((lane+.60)/.075,2.))
    +.95*exp(-pow((lane+.28)/.105,2.))
    +.72*exp(-pow((lane-.04)/.07,2.))
    +1.0*exp(-pow((lane-.34)/.095,2.))
    +.66*exp(-pow((lane-.65)/.065,2.));
   optical+=density*strands*smoothstep(0.,.05,t)*(1.-smoothstep(.88,1.,t))*stepSize*.19;
  }
 }
 return 1.-exp(-optical);
}
`;
