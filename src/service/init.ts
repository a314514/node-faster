import getModel from '../db/model'
import getService from '../db/service'
import Service from './service'
import { Method } from '../router/decoratord'
import query from './query'
import del from './del'
import queryAll from './queryAll'
import add from './add'
import id from '../utils/guid'

let innerService: any = {}

let model: any
export class Base extends Service {
  public modelbase: Array<string>;
  public base: Array<string>;
  public relation: any;
  public modelName: string;
  constructor(public model: any) {
    super();
    this.modelbase = model['modelbase']
    this.base = model['base']
    this.relation = model['relation']
    this.modelName = model['modelName']
  }
  /**
   * 
   * @param param
   *  {
   *    path: 关联关系别名
   * }
   */
  @Method('/query')
  query(param?: object): any {
    return Promise.resolve(query(model, this.modelName, param)).then(res => {
      return res
    })
  }
  @Method('/queryall')
  queryall(param: any = {}): any {
    return Promise.resolve(queryAll(model, this.modelName, param)).then(res => {
      return res
    })
  }
  @Method('/batchCascadeAdd')
  batchCascadeAdd(param: any = {}): any {
    return Promise.resolve(add(model, this.modelName, param)).then(res => {
      return res
    })
  }
  @Method('/batchCascadeDelete')
  batchCascadeDelete(param: any = {}): any {
    return Promise.resolve(del(model, this.modelName, param)).then(res => {
      return res
    })
  }
  @Method('/add')
  add(param: any = {}): any {
    let baseField = this.base.join(',')
    let insertData: any = []
    for (let key of this.base) {
      if (key === 'updateTime' || key === 'createTime') {
        insertData.push(`'${this.dateFormat(new Date())}'`)
      } else {
        insertData.push(`'${param[key] || ""}'`)
      }
    }
    const insertid = id()
    var sql: string = `insert into ${this.modelName} (id,${baseField}) values ('${insertid}',${insertData.join(',')})`
    return Promise.resolve(this.Mysql.exec(sql)).then((res: any) => {
      if (res.results.affectedRows > 0) {
        return {
          code: '200',
          message: "添加成功",
          res: {
            id: insertid
          }
        }
      } else {
        return {
          code: '200',
          message: "添加成功"
        }
      }
    }).catch(res => {
      return res
    })
  }
  @Method('/save')
  saveOrUpdate(param: any = {}): any {
    let baseField = this.modelbase.join(',')
    let insertData: any = []
    let updateSql = ""
    for (let key of this.modelbase) {
      if (key === 'updateTime' || key === 'createTime') {
        insertData.push(`'${this.dateFormat(new Date())}'`)
      } else {
        insertData.push(`'${param[key] || ""}'`)
      }
    }
    this.modelbase.map((item: string) => {
      updateSql += `${item}=values(${item}),`
    })
    const insertid = param['id'] ? param['id'] : id()
    var sql: string = `insert into ${this.modelName} (id,${baseField}) values ('${insertid}',${insertData.join(',')}) on duplicate key update ${updateSql.substr(0, updateSql.length - 1)}`
    return Promise.resolve(this.Mysql.exec(sql)).then((res: any) => {
      if (res.results.affectedRows > 0) {
        return {
          code: '200',
          message: "更新完成",
          res: {
            id: insertid
          }
        }
      } else {
        return {
          code: '500',
          message: "更新失败"
        }
      }
    }).catch(res => {
      return res
    })
  }
  @Method('/get')
  get(param: any = {}): any {
    let baseField = this.modelbase.join(',')
    var sql: string = `select id, ${baseField} from ${this.modelName} where id = '${param.id}'`
    return Promise.resolve(this.Mysql.exec(sql)).then((res) => {
      return res.results[0]
    }).catch(res => {
      return res
    })
  }
  @Method('/del')
  del(param: any = {}): any {
    let ids: string = ""
    eval(param.id || []).map((item: string) => {
      ids += `"${item}",`
    })
    var sql: string = `delete from ${this.modelName} where id in (${ids.substr(0, ids.length - 1)})`
    return Promise.resolve(this.Mysql.exec(sql)).then((res) => {
      if (res.results.affectedRows > 0) {
        return {
          code: '200',
          message: "删除成功"
        }
      } else {
        return {
          code: 500,
          message: "没有找到要删除的数据"
        }
      }
    }).catch(res => {
      return res
    })
  }
  @Method('/update')
  update(param: any = {}): any {
    let id = param['id']
    let insertData: any = []
    for (let key of this.modelbase) {
      if (key === 'updateTime') {
        insertData.push(`${key} = '${this.dateFormat()}'`)
      } else if (key === 'createTime') {
        insertData.push(`${key} = '${this.dateFormat(param[key])}'`)
      } else {
        insertData.push(`${key} = '${param[key] || ""}'`)
      }
    }
    var sql: string = `update ${this.modelName} set ${insertData.join(',')}  where id = "${id}"`
    return Promise.resolve(this.Mysql.exec(sql)).then((res) => {
      if (res.results.affectedRows > 0) {
        return {
          code: '200',
          message: "更新成功"
        }
      } else {
        return {
          code: 500,
          message: "没有找到要更新的数据"
        }
      }
    }).catch(res => {
      return res
    })
  }
}
export function service(): object {
  return getModel().then(res => {
    model = res
    let service: any = {}
    return getService().then(_res => {
      for (let m in model) {
        let base: any = new Base(model[m])
        innerService[`${m}`] = {}
        for (let key in base) {
          //&& _res.indexOf(key) > -1
          if (key.indexOf('/') > -1) {
            service[`${m.toLowerCase()}${key.toLowerCase().replace(/\//g, '')}`] = function (param: any) {
              return base[key].call(base, param)
            }
            innerService[`${m}`][`${key.replace(/\//g, '')}`] = (param: any) => {
              return base[key].call(base, param)
            }
          }
        }
      }
      return service
    })
  })
}
function getServiceAll(): object {
  return getModel().then(res => {
    model = res
    let service: any = {}
    for (let m in model) {
      let base: any = new Base(model[m])
      innerService[`${m}`] = {}
      for (let key in base) {
        if (key.indexOf('/') > -1) {
          if (!service[`${m}`]) {
            service[`${m}`] = {}
          }
          //${key.toLowerCase().replace(/\//g, '')}
          service[`${m}`][`${key.toLowerCase().replace(/\//g, '')}`] = {}
        }
      }
    }
    return service
  })
}
export { innerService, getServiceAll } 
