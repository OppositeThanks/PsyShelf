const {createCanvas}=require('@napi-rs/canvas');
function scanImage(text='The violet lantern is in the garden.'){
 const canvas=createCanvas(1100,180),c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1100,180);c.fillStyle='black';c.font='40px Arial';c.fillText(text,30,90);return canvas.toBuffer('image/jpeg');
}
function scanPdf(text){
 const image=scanImage(text);const commands=Buffer.from('q 550 0 0 90 25 550 cm /Im0 Do Q');
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>'),Buffer.concat([Buffer.from('<< /Length '+commands.length+' >>\nstream\n'),commands,Buffer.from('\nendstream')]),Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1100 /Height 180 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.length+' >>\nstream\n'),image,Buffer.from('\nendstream')])];
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=parts[0].length;objects.forEach((object,i)=>{offsets.push(length);const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);parts.push(part);length+=part.length});
 parts.push(Buffer.from('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF\n'));return Buffer.concat(parts);
}
module.exports={scanImage,scanPdf};
