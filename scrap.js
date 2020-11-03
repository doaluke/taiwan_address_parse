var fs = require('fs'),
    $ = require('cheerio'),
    xlsx = require('node-xlsx'),
    path = require('path'),
    readline = require('readline'),
    rp = require('request-promise'),
    fileFolder = path.join(__dirname, '/data/'),
    ora = require('ora'),
    outputFolder = path.join(__dirname, '/result/')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    // xml Xml_10706
    // excel CEROAD10702.xls
    // xml http://download.post.gov.tw/post/download/Xml_10706.xml
    // excel http://download.post.gov.tw/post/download/CEROAD10702.xls

class AddressJson {
  constructor(){
    this.streetNameData = null
    this.streetXmlData = null

    const spinner = ora('2000 years later')
    this.loading = () => spinner.start()
    this.stopLoading = () => spinner.stop()

    rl.question('資料來源為檔案或是ＵＲＬ?(file/url) ', (type) => {
      if (type == 'url') {
        rl.question('請輸入郵遞區號XML檔 URL? ', (xmlUrl) => {
          rl.question('請輸入路街中英對照Excel檔 URL? ', (streetNameUrl) => {
            this.loading()
            this.init([type, xmlUrl, streetNameUrl])
          });
        });
      } else {
        rl.question('請輸入郵遞區號XML檔名? ', (xmlFileName) => {
          rl.question('請輸入路街中英對照Excel檔名? ', (streetFileName) => {
            this.loading()
            this.init([type, xmlFileName, streetFileName])
          });
        });
      }
    });
  }

  init(params) {
    var flow = (xmlData, excelData) => {
      //excel
      let nameDataSet = {};
      excelData[0].data.map((ele) => {
        let [key, value] = ele
        nameDataSet[key] = value
      })
      this.streetNameData = nameDataSet
      //xml
      let parseXML = $.load(xmlData, {
        ignoreWhitespace : true,
        xmlMode: true,
      })
      let streetDataSet = [], trimStreetDataSet =[],count = 0
      parseXML('Zip32').children().each((i, ele) => {
        let key = $(ele)['0'].name
        let val = $(ele)['0'].children[0].data
        if (typeof streetDataSet[count] == 'undefined') streetDataSet[count] = {}
        streetDataSet[count][key] = val 
        if (key == 'Scope') count++
      })
      streetDataSet.map((ele, index) => {
        let _key = ele['City']+'_'+ele['Area']+'_'+ele['Road']
        trimStreetDataSet[_key] = ele
      })
      this.streetXmlData = trimStreetDataSet
      // generate json
      this.stopLoading()
      rl.question('建立檔案?(yes/no) ', (ans) => {
        if(ans == 'yes') {
          //generate file
          this.generateJson()
        }else{
          rl.close();
        }
      })
    }

    let xmlData = null, excelData = null
    switch (true) {
      case params[0] == 'file':
        xmlData = fs.readFileSync(fileFolder + params[1], {encoding: 'utf-8'})
        excelData = xlsx.parse(fs.readFileSync(fileFolder + params[2]))
        flow(xmlData, excelData)
      break;
      case params[0] == 'url':
        rp({
          url: params[1],
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
            "Content-Type":'application/xml;charset=utf-8'
          }
        }).then(body => {
            xmlData = body
            return rp({
              url: params[2],
              headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              },
              encoding: null
            })
          })
          .then(body => {
            excelData = xlsx.parse(body)
            flow(xmlData, excelData)
          })
          .catch(function (err) {
            if(err) throw err
          })
      break;
    }
  }

  mergeData() {
    let xml = this.streetXmlData, nameData = this.streetNameData
    if (xml && nameData) {
      // console.log(this.streetXmlData);
      for (var key in xml) {
        if (xml[key].hasOwnProperty('Road')) {
          if (nameData[xml[key]['Road']]) xml[key]['eRoad'] = nameData[xml[key]['Road']]
        }
      }
    }
    return xml
  }

  generateJson() {
    let data = this.mergeData(), contenter = [], counter = 1
    for(var key in data) {
      contenter[counter] = {
        "CITY":data[key]['City'],
        "ZIPCODE":data[key]['Zip5'].slice(0,3),
        "AREA":data[key]['Area'],
        "ROAD_NO":counter,
        "ROAD":data[key]['Road'],
        "EROAD":data[key]['eRoad'],
      }
      counter++
    }
    if (contenter.length > 0) {
      let str = JSON.stringify(contenter)
      fs.writeFile(outputFolder + 'road.json', str, (err) => {
        if (err) {
          throw err
        }
        console.log('File complete.')
        rl.close();
      })
    } 
  }
}
var address = new AddressJson()
