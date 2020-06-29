/**
 * 
 * 
 */
import { ModelBase, objectBase } from './modelbase'
const operatorer = (op: string | number) => {
  const operator: any = {}
  operator[1] = '='
  operator[2] = '>'
  operator[3] = '>='
  operator[4] = '<'
  operator[5] = '<='
  operator[6] = '<>'
  operator[7] = 'like'
  operator[8] = 'in'
  return operator[op]
}
interface condition {
  field: string,
  value: any,
  type: string,
  operator: number
}
interface objectAny {
  [key: string]: objectBase
}
class QueryData extends ModelBase {
  constructor(model: any, priModel: string, param: any) {
    super(model, priModel, param);
  }
  Query = () => {
    const rel = this.getQueryRelation(this.priModel, eval(this.param.path || []))
    const rels: any = []
    for (const item of rel) {
      if (rels.filter((re: { souModel: string, destModel: string }) => re.souModel === item.souModel && re.destModel === item.destModel).length === 0) {
        rels.push(item)
      }
    }
    this.relations = rels
    return Promise.resolve(this.queryData()).then(__res => {
      if (__res.hasCount) {
        return Promise.resolve(this.queryCount()).then(_res => {
          let count = _res.results[0]['count(1)']
          return {
            code: '200',
            message: '',
            result: {
              total: count,
              list: __res.res
            }
          }
        })
      } else {
        return {
          code: '200',
          message: '',
          result: {
            total: __res.res.length,
            list: __res.res
          }
        }
      }
    })
  }
  getLimit() {
    let limit = ``
    if (eval(this.param.pageSize || ``) && eval(this.param.page || ``)) {
      limit = ` limit ${eval(this.param.pageSize) * (eval(this.param.page) - 1)}, ${eval(this.param.pageSize)}`
    }
    if (this.getcondition(false) !== ` `) {
      limit = ``
    }
    return limit
  }
  getOrder() {
    let order = eval(this.param.order || [])
    let orders = ` `
    if (order && order[0]) {
      order.map((ord: { field: any; action: any }) => {
        orders += `${ord.field} ${ord.action},`
      })
      orders = orders.substr(0, orders.length - 1)
    }
    return orders
  }
  splicingSql = (primty: string, rel: Array<any>): string => {
    let nSql = ''
    let baseField: string = this.modelFiled(primty).filed.join(',')
    let selectField: string = ``
    // let selectArea: string = `from (select * from ${primty} ${this.getcondition(true)} ${this.getOrder()} ${this.getLimit()}) as ${this.getModelWord(primty)}`
    let selectArea = `from ${primty} as ${this.getModelWord(primty)}`
    rel.map(item => {
      let destName = item.destModel
      let soulName = item.souModel
      if (item.inRelation === 1) {
        // 一对多
        selectField += `,${this.modelFiled(destName).filed.join(',')} ,${this.getModelWord(destName)}.${soulName}Id as ${this.getModelWord(destName)}_${soulName}Id`
        selectArea += ` left join ${destName} as ${this.getModelWord(destName)} on ${this.getModelWord(destName)}.${soulName}Id = ${this.getModelWord(soulName)}.id`
      } else {
        selectField += `,${this.modelFiled(destName).filed.join(',')}`
        baseField += `,${this.getModelWord(soulName)}.${item.destModel}Id as ${this.getModelWord(soulName)}_${destName}Id`
        selectArea += ` left join ${destName} as ${this.getModelWord(destName)} on ${this.getModelWord(soulName)}.${destName}Id = ${this.getModelWord(destName)}.id`
      }
    })
    nSql = `select ${baseField} ${Array.from(new Set(selectField.split(','))).join(',')}  ${Array.from(new Set(selectArea.split('left'))).join('left')} `
    return nSql
  }
  queryCount = () => {
    let sql = `select count(1) from  ${this.priModel} ${this.getcondition(true)}`
    return Promise.resolve(this.Mysql.exec(sql)).then((res) => {
      return res
    })
  }
  queryData = () => {
    let sql = `select ${this.modelFiled(this.priModel).filed.join(',')} from  ${this.priModel} as ${this.getModelWord(this.priModel)}`
    let hasCount = true
    if (this.getcondition(false).length > 1) {
      hasCount = false
    }
    if (this.relations.length > 0) {
      let order = eval(this.param.order || [])
      let orders = ` `
      if (order && order[0]) {
        orders = `order by `
        order.map((ord: { field: any; action: any }) => {
          orders += `${this.getModelWord(this.priModel)}.${ord.field} ${ord.action},`
        })
        orders = orders.substr(0, orders.length - 1)
      }
      sql = this.splicingSql(this.priModel, this.relations) + this.getcondition(true, true)
      if (!hasCount) {
        sql += this.getcondition(false)
      }
      sql += orders
    } else {
      sql += this.getcondition(true) + `order by ${this.getModelWord(this.priModel)}.createTime desc ` + this.getOrder() + (hasCount ? this.getLimit() : '')
    }

    return Promise.resolve(this.Mysql.exec(sql)).then((res) => {
      if (!res.results.err) {
        return { res: this.formatData(res.results), hasCount }
      } else {
        return { res: [], hasCount }
      }
    }).catch(res => {
      return res
    })
  }
  getcondition = (pri: boolean, needAlias: boolean = false) => {
    let base = ` where 1=1 `
    let that = this
    const where = eval(this.param.where || [])

    if (where && where[0]) {
      let search = where[0]
      for (let rel in where[0]) {
        const relarr: Array<condition> = search[rel]
        for (let item of relarr) {
          let queryAlias = this.getModelWord(this.priModel)
          let field = item.field
          if (!pri) {
            if (item.field.indexOf('.') > 0) {
              queryAlias = getAliasByRelName(item.field.split('.')[0])
              field = item.field.split('.')[1]
              if (item.value && item.operator === 8) {
                base += ` ${rel} ${queryAlias}.${field} ${operatorer(item.operator)} ${item.value}`
              } else if (item.value && item.operator === 7) {
                base += ` ${rel} ${queryAlias}.${field} ${operatorer(item.operator)} '%${item.value}%'`
              } else {
                base += ` ${rel} ${queryAlias}.${field} ${operatorer(item.operator)} '${item.value}'`
              }
            }
          } else {
            if (item.field.indexOf('.') === -1) {
              if (item.value && item.operator === 8) {
                base += ` ${rel} ${needAlias ? queryAlias + '.' + field : field} ${operatorer(item.operator)} ${item.value}`
              } else if (item.value && item.operator === 7) {
                base += ` ${rel} ${needAlias ? queryAlias + '.' + field : field} ${operatorer(item.operator)} '%${item.value}%'`
              } else {
                base += ` ${rel} ${needAlias ? queryAlias + '.' + field : field} ${operatorer(item.operator)} '${item.value}'`
              }
            }
          }
        }
      }
    }
    function getAliasByRelName(name: string) {
      let destName = ''
      for (let item of that.relations) {
        if (item.stName === name) {
          destName = item.destModel
          break;
        }
      }
      return that.getModelWord(destName)
    }
    if (!pri) {
      base = base.substr(10, base.length - 10)
    }
    return base
  }
  formatData = (data: Array<any>) => {
    let newData: any = []
    let that = this
    let minData: any = {
    }
    if (data.length === 0) {
      return newData
    }
    data.map(item => {
      let dataSplic = this.dataRelation(item)
      for (let key in dataSplic) {
        if (!minData[key]) {
          minData[key] = []
        }
        minData[key].push(dataSplic[key])
      }
    })
    let filterData: any = {}
    for (let key in minData) {
      let arr = minData[key]
      let obj: any = {};
      arr = arr.reduce((item: any[], next: any) => {
        obj[next.id] || !next.id ? '' : obj[next.id] = true && item.push(next);
        return item;
      }, []);
      filterData[key] = arr
    }
    let relations: any = this.relations.reverse()
    relations.map((item: any) => {
      filterData = assemble(filterData, item)
    })
    function assemble(data: any, rel: { souModel: string, destModel: string, stName: string, inRelation: Number }): any {
      let assembleData: any = JSON.parse(JSON.stringify(data))
      let sou = that.getModelWord(rel.souModel)
      let dest = that.getModelWord(rel.destModel)
      let key = rel.stName
      let destData = data[dest]
      let souData = data[sou]
      delete assembleData[dest]
      souData.map((item: any) => {
        if (rel.inRelation === 1) {
          item[key] = []
        } else {
          item[key] = {}
        }
      })
      if (rel.inRelation === 1) {
        souData.map((sour: any) => {
          destData.map((dest: { [x: string]: any }) => {
            if (sour.id === dest[`${rel.souModel}Id`]) {
              sour[key].push(dest)
            }
          })
        })
      } else {
        souData.map((sour: any) => {
          destData.map((dest: { [x: string]: any }) => {
            if (dest.id === sour[`${rel.destModel}Id`]) {
              sour[key] = dest
            }
          })
        })
      }
      assembleData[sou] = souData
      return assembleData
    }
    for (let key in filterData) {
      newData = filterData[key]
    }
    return newData
  }
  dataRelation = (itemData: objectAny) => {
    let data: objectAny = {}
    for (let key in itemData) {
      if (key.indexOf('_') > -1) {
        let prefix: string[] = key.split('_')
        let prefixKey = prefix[0]
        let prefixValue = prefix[1]
        if (data[prefixKey]) {
          data[prefixKey][prefixValue] = itemData[key]
        } else {
          let tempdata: objectBase = {}
          tempdata[prefixValue] = itemData[key]
          data[prefixKey] = tempdata
        }
      }
    }
    return data
  }
}

export default (a: any, b: string, c: any) => {
  let data = new QueryData(a, b, c).Query()
  return Promise.resolve(data).then(res => {
    return res
  })
}