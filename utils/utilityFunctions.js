const { AttachmentBuilder } = require("discord.js");
const fs = require('fs');

async function getImageSize(url) {
    let request = await fetch(url);
    if (request.ok) {
        return request.headers.get('content-length') || 0;
    }
}

async function buildImageAttachment(url, metadata) {
    // Get the file size of the thumbnail
    let imgSize = await getImageSize(url);

    // If the item's thumbnail is >10mb, instead display a placeholder image
    let coverImage;
    if (imgSize < 10000000) {
        coverImage = new AttachmentBuilder(url, metadata);
    }

    else {
        let defaultImg = fs.readFileSync('./assets/default-thumbnail.png');
        coverImage = new AttachmentBuilder(defaultImg, { name: 'coverimage.jpg', description: `Cover Image Not Found` })
    }
    
    return coverImage;
}

module.exports = { getImageSize, buildImageAttachment };