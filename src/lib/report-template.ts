/**
 * 估价报告默认模板
 * 当项目没有已保存的报告内容时，使用此模板初始化编辑器
 * 采用标准估价报告结构，估价师可在此基础上进行编辑修改
 */

export function generateDefaultReportTemplate(project: {
    name: string;
    projectNumber?: string;
    address?: string;
    valuationDate?: string;
    propertyType?: string;
    gfa?: number | null;
    extractedMetrics?: Record<string, string | number | null>;
}): string {
    const metrics = project.extractedMetrics ?? {};

    // 安全格式化数值
    const fmt = (val: string | number | null | undefined, suffix = '') => {
        if (val === null || val === undefined) return '<span style="color: #ef4444; background: #fef2f2; padding: 0 4px; border-radius: 2px;">【待填写】</span>';
        if (typeof val === 'number') return val.toLocaleString('zh-CN') + suffix;
        return String(val) + suffix;
    };

    return `
<h1 style="text-align: center; margin-bottom: 0;">房地产估价报告</h1>
<p style="text-align: center; color: #6b7280; font-size: 14px;">Real Estate Valuation Report</p>

<hr />

<h2>一、估价委托方</h2>
<p>${fmt(metrics['client_name'] as string | null)}</p>

<h2>二、估价目的</h2>
<p>${fmt(metrics['valuation_purpose'] as string | null)}</p>

<h2>三、估价对象</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tbody>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600; width: 30%;">项目名称</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.name || '【待填写】'}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600;">项目编号</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.projectNumber || '【待填写】'}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600;">坐落</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.address || fmt(metrics['property_address'] as string | null)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600;">物业类型</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.propertyType || '【待填写】'}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600;">建筑面积</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.gfa ? project.gfa.toLocaleString('zh-CN') + ' ㎡' : '【待填写】'}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f9fafb; font-weight: 600;">估价时点</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${project.valuationDate || fmt(metrics['valuation_date'] as string | null)}</td>
    </tr>
  </tbody>
</table>

<h2>四、估价方法</h2>
<p>本次估价采用以下方法对估价对象进行评估：</p>
<ul>
  <li>比较法（Sales Comparison Approach）</li>
</ul>
<p>估价师对方法的选取理由如下：</p>
<p>【此处填写方法选取理由，说明为何选择该方法进行估价…】</p>

<h2>五、估价过程</h2>

<h3>5.1 比较法估价过程</h3>
<p>【此处描述比较法的具体估价过程，包括可比案例选取、修正系数确定等…】</p>

<h2>六、估价结果</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tbody>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f0f9ff; font-weight: 600; width: 30%;">评估单价</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 18px; font-weight: 700; color: #1d4ed8;">${fmt(metrics['subject_value_unit'] as number | null, ' 元/㎡')}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; background: #f0f9ff; font-weight: 600;">评估总价</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 18px; font-weight: 700; color: #1d4ed8;">${fmt(metrics['subject_value_total'] as number | null, ' 元')}</td>
    </tr>
  </tbody>
</table>

<h2>七、估价假设与限制条件</h2>
<ol>
  <li>本报告估价结果基于估价时点的市场状况。</li>
  <li>【补充其他假设条件…】</li>
</ol>

<h2>八、附件</h2>
<ol>
  <li>估价对象位置图</li>
  <li>估价对象外观照片</li>
  <li>产权证明复印件</li>
  <li>估价师资格证书</li>
</ol>

<hr />

<p style="text-align: right; color: #6b7280; font-size: 13px;">
  估价机构：【机构名称】<br />
  估价师：【估价师姓名】<br />
  报告日期：${new Date().toLocaleDateString('zh-CN')}
</p>
`.trim();
}
