import queryString from "query-string";
import Canvas from "canvas";
import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "pdfjs-dist/legacy/build/pdf.worker.mjs";
import http from "http";
import express from "express";
const app = express();
import bodyParser from "body-parser";
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
import getSystemFonts from "get-system-fonts";
import { spawn } from "node:child_process";

console.log("hello");
/*const foo = "foo";
export default foo;*/

http
  .createServer(async function (req, res) {
    if (req.method == "POST") {
      var data = "";
      req.on("data", function (chunk) {
        data += chunk;
      });
      req.on("end", async function () {
        if (!data) {
          console.log("No post data");
          res.end();
          return;
        } else {
          var dataObject = JSON.parse(data);
          console.log("post:" + dataObject.type);
          if (dataObject.type == "wake") {
            console.log("Woke up in post");
            res.end();
            return;
          } else if (dataObject.type == "convertPdfToPngs") {
            console.log("convertPdfToPngs");
            let pngs = await pdfToPngCreateRes(dataObject); //VOLUME1, title, pdftitle, pdf
            console.log("pngs", pngs);
            res.end(
              JSON.stringify({
                ans: String(pngs.ans),
                pngs: JSON.stringify(pngs.pngs),
                comment: String(pngs.comment),
                pgS: String(pngs.pgS),
                pgE: String(pngs.pgE),
                ctC: String(pngs.ctC),
              })
            ); //{ ans: "TEST" }
            return;
          }
          res.end();
        }
      });
    } else if (req.method == "GET") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("HELLO\n");
    }
  })
  .listen(process.env.PORT);

//テスト用
/*let arrayRes = []; //
let testPdf = fs.readFileSync("test.pdf"),
  pdfTitle = "test",
  pgS = "1",
  pgE = "1",
  ctC = "";
await pdfToPngHandller(testPdf, pdfTitle, pgS, pgE, ctC).then(
  (result) =>
    async function () {
      console.log("results", result);
      for (let i = 0; i < result.length; i++) {
        let bs64 = Buffer.from(result[i][1]).toString("base64");
        arrayRes.push([String(result[i][0]), String(bs64)]);
      }
      return arrayRes;
    }
);*/

//ステップ0・2　base64をpdfに変換していったん保存する。処理を得たのち、返信用に形を整える
async function pdfToPngCreateRes(data) {
  let VOLUME1 = data.VOLUME1,
    title = data.title,
    pdfTitle = data.pdfTitle,
    pdf = data.pdf,
    pgS = data.pgS,
    pgE = data.pgE,
    ctC = data.ctC;
  let req = JSON.stringify({ p1: String(VOLUME1), p2: String(title) });
  let res = await fetching1(String(process.env.uri1), req);
  console.log("res", res);
  if (res.type == "OK") {
    let buf = Buffer.from(pdf, "base64");
    /*fs.writeFileSync("file.pdf", buf);*/
    let arrayPNGs = [];
    //resultPNGs は { array: array, comment: comment, pgS: pgS, pgE: pgE }
    let resultPNGs = await pdfToPngHandller(buf, pdfTitle, pgS, pgE, ctC);
    for (let i = 0; i < resultPNGs.array.length; i++) {
      let bs64 = Buffer.from(resultPNGs.array[i][1]).toString("base64");
      arrayPNGs.push([String(resultPNGs.array[i][0]), String(bs64)]);
    }
    return {
      ans: "OK",
      pngs: arrayPNGs,
      comment: resultPNGs.comment,
      pgS: resultPNGs.pgS,
      pgE: resultPNGs.pgE,
      ctC: resultPNGs.ctC,
    };
  } else {
    return {
      ans: "ERR",
      pngs: [null],
      comment: null,
      pgS: null,
      pgE: null,
      ctC: null,
    };
  }
}

//上の続き。空き状況を確認する
async function fetching1(uri, okuruJson) {
  try {
    /*console.log(okuruJson);*/
    const res = await fetch(uri, {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: okuruJson,
    });
    const kekka = await res.json();
    const strings = await JSON.parse(JSON.stringify(kekka));
    const data = strings["結果"];
    /*console.log("data: ", data);*/
    return data;
  } catch (error) {
    console.log(error);
    return "APIエラーでは？";
  }
}

//ステップ1　PDFを取り出し、PNGを作る
async function pdfToPngHandller(buf, pdfTitle, pgS, pgE, ctC) {
  let array = [],
    comment = "",
    gDchoices = { disableFontFaceIs: false };

  //システムフォントの確認
  try {
    const files = await getSystemFonts();
    console.log("getSystemFonts\n", files.join("\n"));
    const result = spawn("fc-list");
    result.stdout.on("data", (data) => {
      console.log(`fc-list Received chunk ${data}`);
    });
    fs.readdirSync("./ndcmaps/").forEach(
      (file) => {
        console.log("ndcmaps: ", file);
      }
    fs.readdirSync("./ndsfc/fonts/google2/").forEach(
      (file) => {
        console.log("google2: ", file);
      }
  } catch (e) {
    console.log(e);
  }

  if (String(ctC) == "TRUE") {
    gDchoices.disableFontFaceIs = true;
  } else {
    ctC = "FALSE";
  }
  console.log("disableFontFaceIs", gDchoices.disableFontFaceIs);
  const pdfData = new Uint8Array(buf);
  let png = await pdfjsLib
    .getDocument({
      data: pdfData,
      cMapUrl: "./ndcmaps/",
      cMapPacked: true,
      disableFontFace: gDchoices.disableFontFaceIs,
      useSystemFonts: false,
      standardFontDataUrl: "./ndsfc/fonts/google2/",
    })
    .promise.then(async function (pdfIs) {
      console.log("pdfIs", pdfIs, "for", pdfIs.numPages, "pages");
      //ページ範囲（FRなら全部。ただし49で終了）
      if (
        pgS != null &&
        String(pgS) != "FR" &&
        Number(pgS) > 0 &&
        Number(pgS) < 50 &&
        Number(pgS) <= Number(pgE) &&
        Number(pgS) <= Number(pdfIs.numPages)
      ) {
        pgS = Math.floor(Number(pgS));
      } else {
        pgS = 1;
      }
      if (
        pgE != null &&
        String(pgE) != "FR" &&
        Number(pgE) > 0 &&
        Number(pgE) < 50 &&
        Number(pgE) >= Number(pgS) &&
        Number(pgE) <= Number(pdfIs.numPages)
      ) {
        pgE = Math.floor(Number(pgE));
      } else {
        pgE = Number(pdfIs.numPages);
      }
      let rised = 0;
      for (let i = Number(pgS); i < pdfIs.numPages + 1; i++) {
        //単ページで切り出し
        const page = await pdfIs.getPage(Number(i));
        const viewport = page.getViewport({ scale: 4.0 });
        //カンバス用意
        const canvas = Canvas.createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        //描画
        await page.render({ canvasContext: ctx, viewport }).promise;
        //出力
        const image = canvas.toBuffer();
        console.log("image", image);
        const u8arr = new Uint8Array(image);
        const name = String(pdfTitle) + "-" + String(Number(i)) + ".png";
        array.push([name, u8arr]);
        console.log(array[Number(rised)][0]);
        rised++;
        //ページ指定による終了
        if (Number(i) == Number(pgE)) {
          break;
        }
        //ページ制限超過による終了
        if (Number(rised) >= 49) {
          if (Number(pdfIs.numPages) > 50 && Number(pgE) - Number(pgS) > 50) {
            comment = "Specify pdf pages under 49pcs.";
          }
          break;
        }
      }
      return { array: array, comment: comment, pgS: pgS, pgE: pgE, ctC: ctC };
    })
    .catch();
  console.log("png", png);
  /*fs.writeFileSync(png.array[0][0], png.array[0][1]); //お試し用*/
  return png;
}
