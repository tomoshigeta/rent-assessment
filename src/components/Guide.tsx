'use client'

import { EXCEL_SPEC } from '@/excel/columns'
import {
  FAIR_BAND_PCT, HORIZON_MONTHS, MIN_SAMPLE_COUNT, MOVING_COST_MONTHS,
  RENEWAL_FEE_MONTHS, TENANT_CEILING_FACTOR,
} from '@/core'

/** 画面上の使い方。ファイル未読込のときは自動で開く。 */
export function Guide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="panel">
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>使い方</h2>
        <button className="btn small" onClick={onToggle}>{open ? '閉じる' : '開く'}</button>
      </div>
      {!open ? null : (
        <div style={{ marginTop: 14 }}>
          <p className="lead" style={{ marginTop: 0 }}>
            周辺の募集条件から対象住戸の賃料水準を求め、<strong>貸主と借主の双方が成立する賃料の幅</strong>を出します。
            その幅の中から提示額を選ぶのは、あなたの判断です。アプリは推奨額を出しません。
          </p>

          <h3>手順1　入力シートを用意する</h3>
          <p>
            <a href={`/${EXCEL_SPEC.fileName}`} download><strong>入力シートをダウンロード</strong></a>し、
            募集図面を見ながら記入します。記入済みの
            <a href="/更新賃料検討_入力シート_記入例_麻布十番.xlsx" download>記入例</a>もあります。
          </p>
          <p>シートは2枚です。<strong>2行目は記入例なので消さずに残し、3行目から書いてください。</strong></p>
          <table className="data">
            <thead><tr><th>シート</th><th>書くこと</th><th>必須の列</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>対象物件</strong></td>
                <td>更新を検討している部屋。<strong>1行だけ</strong></td>
                <td>物件名・現在家賃・現在管理費・面積</td>
              </tr>
              <tr>
                <td><strong>比較事例</strong></td>
                <td>周辺の募集中物件。<strong>{MIN_SAMPLE_COUNT}件以上</strong></td>
                <td>物件名・賃料・管理費・面積・募集元・確認日</td>
              </tr>
            </tbody>
          </table>

          <div className="warnbox">
            <strong>比較事例の選び方が、結果を最も左右します。</strong>
            アプリは<strong>面積の違いしか揃えません。</strong>築年・階数・向き・設備の差は補正しないので、
            <strong>条件の近い物件だけを、あなたが選んでシートに書いてください。</strong>
            書いた行はすべて集計に入ります。築年が20年違う物件を混ぜると、その分だけ結果がずれます。
          </div>

          <p className="note">
            金額は<strong>すべて税込</strong>で、家賃と管理費を分けて書きます（アプリが合算します）。
            管理費がなければ0と書いてください。空欄にはしないでください。<br />
            <strong>募集元と確認日は必須</strong>です。借主が自分で確かめられない事例は、借主から見れば根拠になりません。
          </p>

          <h3>手順2　シートを読み込む</h3>
          <p>
            上の「ファイルを選択」から記入したシートを選びます。読み込んだ内容が表で出るので、
            <strong>金額と面積が図面どおりか確かめてください。</strong>
            桁違いや単位違いが疑われる行には注意書きが出ます（「万円単位で入っていませんか」など）。
            必須項目が欠けた行は、赤くなって集計から外れます。
          </p>

          <h3>手順3　貸主の前提を入れる</h3>
          <table className="data">
            <tbody>
              <tr>
                <th style={{ width: '11em' }}>原状回復費用</th>
                <td>
                  この借主が退去したとき、<strong>貸主が負担する</strong>補修費の見込み。<strong>必須です。</strong>
                  あえて既定値を置いていません。入れた額がそのまま貸主側の下限を動かすので、
                  自分で見積もった数字を入れてください。
                </td>
              </tr>
              <tr>
                <th>空室期間</th>
                <td>退去から次の入居までにかかる見込みの月数。1〜3から選びます。</td>
              </tr>
              <tr>
                <th>査定賃料の上書き</th>
                <td>
                  業者査定や自社の相場観がある場合に、その額を直接入れます。
                  空欄なら比較事例から自動で計算します。
                  <strong>上書きすると、{MIN_SAMPLE_COUNT}件という最低件数は不問になります。</strong>
                </td>
              </tr>
              <tr>
                <th>提示額</th>
                <td>
                  借主に提示する金額。<strong>入れないと資料を出せません。</strong>
                  1,000円単位に丸めた候補がボタンで出るので、そこから選ぶか、自分で入れてください。
                </td>
              </tr>
            </tbody>
          </table>

          <h3>手順4　結果を読む</h3>
          <table className="data">
            <tbody>
              <tr>
                <th style={{ width: '11em' }}>査定賃料</th>
                <td>比較事例の<strong>㎡単価の中央値 × 対象物件の面積</strong>。この部屋を今募集したら付くはずの賃料です。</td>
              </tr>
              <tr>
                <th>貸主側の下限</th>
                <td><strong>これを下回ると、退去させて再募集したほうが得</strong>になる額。原状回復費用と空室期間で動きます。</td>
              </tr>
              <tr>
                <th>借主側の上限</th>
                <td>
                  <strong>これを上回ると、借主は転居したほうが得</strong>になる額。
                  現在賃料 × {TENANT_CEILING_FACTOR.toFixed(4)} で、査定賃料には左右されません。
                  つまり<strong>現在賃料の約{((TENANT_CEILING_FACTOR - 1) * 100).toFixed(1)}%増が、借主が動かない上限</strong>の目安です。
                </td>
              </tr>
              <tr>
                <th>r（掛け目）</th>
                <td>提示額 ÷ 査定賃料。r = 1.00 が査定どおり、1.05 なら査定より5%高い、という意味です。</td>
              </tr>
              <tr>
                <th>逆転月</th>
                <td>提示額を入れると出ます。<strong>その額なら何ヶ月目から転居のほうが安くなるか</strong>。{HORIZON_MONTHS}ヶ月より後なら、比較期間の外です。</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 12 }}>
            <strong>「双方が成立しません」と出たら。</strong>
            貸主下限が借主上限を上回った状態で、エラーではありません。
            <strong>この条件では、交渉ではなく退去を前提に考えるべき</strong>という答えです。
            原状回復費用や空室期間の見込みを見直すか、退去後の再募集を検討してください。
          </p>
          <p>
            <strong>「値下げ局面です」と出たら。</strong>
            現在賃料が査定賃料を上回っています。上限 r は借主の転居コストによる居座り余地であって、
            値上げの根拠ではありません。
          </p>

          <h3>手順5　資料を出す</h3>
          <p>
            提示額を入れると3つのボタンが押せるようになります。
          </p>
          <table className="data">
            <tbody>
              <tr>
                <th style={{ width: '13em' }}>貸主用の資料</th>
                <td><strong>社外秘。</strong>r の幅、貸主下限、原状回復費用、置いている仮定まで載ります。借主へは渡さないでください。</td>
              </tr>
              <tr>
                <th>借主用の資料</th>
                <td>
                  借主へ渡す資料。比較した事例を全件、募集元と確認日つきで載せます。
                  <strong>貸主側の数字は一切入っていません。</strong>
                </td>
              </tr>
              <tr>
                <th>メールの下書きを作る</th>
                <td>
                  借主へ送るメールを AI に書かせるための文章を出します。
                  <strong>全文をコピーして、お使いの AI に貼ってください。</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="note">
            資料はブラウザの「印刷 → PDFとして保存」で出します。印刷画面では、ヘッダーやボタンは自動で消えます。
          </p>

          <h3>手順6　メールを作る</h3>
          <p>
            「メールの下書きを作る」を押すと、借主名・改定開始希望日・回答希望日・差出人を入れる欄が出ます。
            入れた値はそのまま文章に差し込まれ、<strong>空欄にした項目は【　】のまま残る</strong>ので、後から埋められます。
            差出人は次回から自動で入ります。
          </p>
          <p>
            日付を入れると、<strong>回答期限が短すぎないか、改定開始日が前回更新日と合っているか</strong>を確認します。
            警告が出ても送れますが、送る前に一度確かめてください。
          </p>
          <div className="warnbox">
            AI が書いた文面は、<strong>そのまま送らず必ず内容を確認してください。</strong>
            増額の可否や文面の性格についての判断は、送る側が負うものです。
          </div>

          <h3>保存について</h3>
          <p>
            <strong>このアプリは案件を保存しません。</strong>記入した Excel が保存データそのものです。
            条件を変えて検討し直すときは、Excel を直して読み込み直してください。
            差出人の連絡先だけはブラウザが覚えています。
          </p>

          <h3>置いている仮定</h3>
          <p className="note">
            比較期間 {HORIZON_MONTHS}ヶ月／更新料 新賃料の{RENEWAL_FEE_MONTHS}ヶ月分／
            転居費用 現在賃料の{MOVING_COST_MONTHS}ヶ月分／相場並みの帯 ±{FAIR_BAND_PCT}%。
            いずれも実務感覚で置いた値で、変えれば結果が動きます。
            根拠と、実際の募集図面との差は <code>docs/spec.md</code> 第2章に書いてあります。
            結果の画面にも一覧が出ます。
          </p>
        </div>
      )}
    </section>
  )
}
