// FaceMesh Data Reception
//////////////////////////
var head = { x: 0, y: 0, z: 0, mouth: 0 };

var rightEyeData = [];
var leftEyeData = [];

function resetEye() {
    rightEyeData = [];
    leftEyeData = [];
}

function rgba_to_grayscale(rgba, nrows, ncols) {
    var gray = new Uint8Array(nrows * ncols);
    for (var r = 0; r < nrows; ++r)
        for (var c = 0; c < ncols; ++c)
            gray[r * ncols + c] = (2 * rgba[r * 4 * ncols + 4 * c + 0] + 7 * rgba[r * 4 * ncols + 4 * c + 1] + 1 * rgba[r * 4 * ncols + 4 * c + 2]) / 10;
    return gray;
}

function getPupil(mesh, top, right, left, gray) {
    const row = mesh[top][1];
    const col = mesh[right][0];
    const width = Math.abs(mesh[left][0] - mesh[right][0]);
    const scale = 2 * width;

    const [r, c] = do_puploc(row, col, scale, 7, gray);

    const relativeCol = c - col;
    const ratio = relativeCol / width;

    return {
        r, c, ratio
    };
}

const right = [
    33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7
];

const left = [
    263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249
];

var nextBlinkTS = 0;

function facemeshMessage(e) {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    const data = e.data;

    const face = data.faces[0];

    if (face) {
        const mesh = face.scaledMesh;
        mesh.forEach(point => drawPoint(overlayCtx, point[0], point[1], 1.5, "#36f"));

        const { roll, yaw, pitch } = getHeadRotation(overlayCtx, face.scaledMesh);

        const mouthRight = mesh[78];
        const mouthLeft = mesh[308];
        const mouthWidth = distance3d(mouthRight, mouthLeft);

        const mouthTop = mesh[13];
        const mouthBottom = mesh[14];
        const mouthHeight = distance3d(mouthTop, mouthBottom);

        vrmManager.tween(head, {
            x: pitch + Math.PI / 2,
            y: yaw,
            z: roll,
            mouth: mouthHeight / mouthWidth
        }, () => {
            var neckNode = vrmManager.rotation(Bone.Neck);
            neckNode.x = head.x;
            neckNode.y = head.y;
            neckNode.z = head.z;

            var chestNode = vrmManager.rotation(Bone.Spine);
            chestNode.x = head.x / 3;
            chestNode.y = head.y / 2;
            chestNode.z = head.z / 1.5;

            vrmManager.setPreset(Preset.A, head.mouth);
        }, "head", null, 100);

        if (options.get("auto-blink")) {
            if (Date.now() > nextBlinkTS) {
                vrmManager.setPreset(Preset.Blink, 1);
                nextBlinkTS = Date.now() + random(5000, 8000);
            } else vrmManager.setPreset(Preset.Blink, 0);
        } else {
            // Right
            const rightEyeImg = clipEyeImage(ctx, mesh, 159, 145, 33, 133);
            const processedRightEye = processEyeImage(rightEyeImg);

            linkSize(rightEyeCanvas, rightEyeImg);
            rightEyeCtx.putImageData(processedRightEye.thresholded, 0, 0);

            rightEyeData.push(processedRightEye.ratio);
            const meanRight = calcMean(rightEyeData);
            const stdevRight = stdev(rightEyeData);
            const zScoreRight = (processedRightEye.ratio - meanRight) / stdevRight;

            // Left
            const leftEyeImg = clipEyeImage(ctx, mesh, 386, 374, 362, 263);
            const processedLeftEye = processEyeImage(leftEyeImg);

            linkSize(leftEyeCanvas, leftEyeImg);
            leftEyeCtx.putImageData(processedLeftEye.thresholded, 0, 0);

            leftEyeData.push(processedLeftEye.ratio);
            const meanLeft = calcMean(leftEyeData);
            const stdevLeft = stdev(leftEyeData);
            const zScoreLeft = (processedLeftEye.ratio - meanLeft) / stdevLeft;

            if ((zScoreLeft <= -1.5 && zScoreRight <= -0.5) || (zScoreLeft <= -0.5 && zScoreRight <= -1.5)) {
                vrmManager.setPreset(Preset.Blink, 1);
            } else {
                vrmManager.setPreset(Preset.Blink, 0);

                if (zScoreRight <= -1.5) vrmManager.setPreset(Preset.BlinkR, 1);
                else vrmManager.setPreset(Preset.BlinkR, 0);

                if (zScoreLeft <= -1.5) vrmManager.setPreset(Preset.BlinkL, 1);
                else vrmManager.setPreset(Preset.BlinkL, 0);
            }
        }

        if (options.get("eye-track")) {
            const leftPoints = left.map(i => mesh[i]);
            const rightPoints = right.map(i => mesh[i]);

            eyesCtx.clearRect(0, 0, eyesCanvas.width, eyesCanvas.height);
            clip(eyesCtx, leftPoints, canvas);
            clip(eyesCtx, rightPoints, canvas);

            drawPolygon(overlayCtx, leftPoints, 1.5, "#36f");
            drawPolygon(overlayCtx, rightPoints, 1.5, "#36f");

            var rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            var image = {
                pixels: rgba_to_grayscale(rgba, canvas.height, canvas.width),
                nrows: canvas.height,
                ncols: canvas.width,
                ldim: canvas.width
            };

            var r = getPupil(mesh, 159, 33, 133, image);
            var l = getPupil(mesh, 386, 362, 263, image);

            if (r.r >= 0 && r.c >= 0 && r.ratio >= 0
                && l.r >= 0 && l.c >= 0 && l.ratio >= 0) {
                drawPoint(overlayCtx, r.c, r.r, 2, "red");
                drawPoint(overlayCtx, l.c, l.r, 2, "red");

                const avgRatio = (l.ratio + r.ratio) / 2;

                lookAtTarget.position.x = ((10 * avgRatio) - 5) * 5;
            }
        }
    }

    stats.facemesh.end();
}