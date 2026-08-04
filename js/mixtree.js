var svg = d3.select("svg"),
    diagonal = d3.linkHorizontal().x(d => d.x).y(d => d.y),
    dx = 195,
    dy = 150;

function load_defs() {
    var defs_svg = d3.select("body").append("svg").attr("height", "0px").attr("class", "position-absolute");
    defs_svg.append("svg:pattern")
        .attr("id", "select-fomular")
        .attr("height", "1px")
        .attr("width", "1px")
        .append("svg:image")
        .attr("height", "40px")
        .attr("width", "40px")
        .attr("x", "0px")
        .attr("y", "0px")
        .attr("href", "img/select-fomular.png")

    for (let id of Object.keys(henches)) {
        defs_svg.append("svg:pattern")
            .attr("id", "monster-" + henches[id]["hid"])
            .attr("height", "1px")
            .attr("width", "1px")
            .append("svg:image")
            .attr("height", "50px")
            .attr("width", "50px")
            .attr("x", "0px")
            .attr("y", "0px")
            .attr("href", henches[id]["icon"])
    };
}

// Toggle children on click.
function click(d) {
    console.log(d);
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
    update_svg(d);
}

function init_card() {
    // Bucket by type first instead of relying on Object.keys(henches) being
    // in type-grouped order - that only held for the old dataset because its
    // ids happened to be assigned sequentially per type.
    let byType = {};
    for (let id of Object.keys(henches)) {
        let hench = henches[id];
        if (hench["level"] <= 120) continue;
        (byType[hench["type"]] = byType[hench["type"]] || []).push(hench);
    }
    for (let type in byType) {
        byType[type].sort((a, b) => a["level"] - b["level"]);
    }

    for (let type = 0; type <= 7; type++) {
        let block = "";
        for (let hench of (byType[type] || [])) {
            let banner = '<img class="position-absolute hench-banner" src="img/banner.png" alt="mix only">';
            if (hench["drop"] == true) {
                if (hench["drop_only"]) {
                    banner = '<img class="position-absolute hench-banner" src="img/banner1.png" alt="drop only">';
                } else {
                    banner = '<img class="position-absolute hench-banner" src="img/banner2.png" alt="mixable">';
                }
            }
            block += `<div class="card px-0 mx-5 mt-5 text-center border-0 hench-card" style="width: 180px; cursor: pointer;" onclick="generate_svg(${hench['hid']})">
                <img class="hench-img m-auto" src="${hench['img']}">
                <img class="card-img-top" src="img/card-image.png">
                ${banner}
                <div class="card-footer pt-0 pb-1">
                    <p class="p-0 m-0 text-truncate hench-title font-weight-bold">Lv.${hench["level"]} ${translate(hench["name"])}</p>
                </div>
              </div>`;
        }
        $("#hench-panel").append(`
            <div id="tab${type}" class="row hench-tab justify-content-center py-3 ${type != 0 ? 'd-none': ''}">
                ${block}
            </div>
        `);
    }
}

function expand() {
    if (root) {
        let leaves = root.leaves();
        if (leaves.length > 0) {
            for (const leave of leaves) {
                leave.children = leave._children;
                if (leave._children && leave._children.length > 0){
                    d3.select(`#g${leave.id} rect`).attr("display", "");
                }
            }
        }
        update_svg(root, true);
    }
}

function collapse() {
    if (root) {
        let leaves = root.leaves();
        console.log(leaves);
        if (leaves.length > 0) {
            let max = Math.max(...leaves.map(o => o.depth));
            for (const leave of leaves) {
                if (leave.depth == max) {
                    leave.parent.children = null;
                    d3.select(`#g${leave.parent.id} rect`).attr("display", "none");
                }
            }
        }
        update_svg(root, true);
    }
}

function generate_svg(hid, node) {
    if (hid) {
        hid = hid || root.data.hid;
        if (!henches[hid] || henches[hid].drop_only) return;

        // jump to step2
        $("html, body").animate({
            scrollTop: $(".step2").offset().top
        }, 100);
    }
    
    if (node) {
        generate_tree(node, []);
    } else {
        generate_tree(henches[hid], []);
    }

    tree = d3.tree().nodeSize([dx, dy]);
    root = d3.hierarchy(henches[hid]);
    // Entering links on the very first render animate from (root.x0, root.y0)
    // - without this they're undefined, producing a NaN path `d` for one frame.
    root.x0 = 0;
    root.y0 = 0;

    root.descendants().forEach((d, i) => {
        d.id = i;
        if (d.depth && d.depth > 6) {
            d.children = null;
        }
        d._children = d.children;
    });

    // init svg
    svg.select("g").remove();
    g = svg.append("g").style("display", "none");
    zoomBehaviours = d3.zoom().scaleExtent([0.1, 1]).on("zoom", (ev) => g.attr("transform", ev.transform));
    svg.call(zoomBehaviours);
    setTimeout(() => zoomBehaviours.translateTo(svg, 0, 0), 100);

    gLink = g.append("g")
        .attr("fill", "red")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5);

    gNode = g.append("g")
        .attr("cursor", "pointer")
        .attr("pointer-events", "all");

    update_svg(root, true);
    $("#fomular-panel").addClass("d-none");
}

function update_svg(source, resize) {
    const duration = d3.event && d3.event.altKey ? 2500 : 250;
    const nodes = root.descendants().reverse();
    const links = root.links();

    // Compute the new tree layout.
    tree(root);
    const transition = svg.transition()
        .duration(duration)
        .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

    // Update the nodes…
    const node = gNode.selectAll("g")
        .data(nodes, d => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node.enter().append("g")
        .attr("transform", d => `translate(${source.x},${source.y})`)
        .attr("id", d => `g${d.id}`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .on("click", (e, d) => {
            if (d._children == null) return;
            if (d.children != null) {
                d.children = null;
                d3.select(`#g${d.id} rect`).attr("display", "none");
            } else {
                d.children = d._children;
                if (d.data.fomular.length > 1 && d.children && d.children.length > 0) {
                    d3.select(`#g${d.id} rect`).attr("display", "");
                }
            }
            update_svg(d);
        });

    const nodeShape = nodeEnter.append("circle")
        .attr("r", "26px")
        .style("stroke", d => henches[d.data.hid]["drop_only"] ? "red" : "black")
        .style("stroke-width", 5)
        .style("fill", d => "url(#monster-" + (d.data.hid || 1) + ")");

    nodeEnter.append("text")
        .attr("y", "48px")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .text(d => `Lv.${d.data.level} ${translate(d.data.name).replaceAll("&nbsp;", " ")}`)
        .clone(true)

    // select fomular
    nodeEnter.append("rect")
        .attr("height", "40px")
        .attr("width", "40px")
        .attr("x", "-20px")
        .attr("y", "-75px")
        .attr("fill", "url(#select-fomular)")
        .attr("display", d => (d.data.fomular.length > 1 && d.children && d.children.length > 0) ? "" : "none")
        .on("click", (e, d) => {
            e.stopPropagation();
            if (d.data.fomular.length > 1 && d.children.length > 0) {
                $("#fomular-panel").removeClass("d-none");
                $("#fomular-title").text(translate(d.data.name).replaceAll("&nbsp;", " "));
                $("#fomular-body").html("");
                for (let index = 0; index < d.data.fomular.length; index++) {
                    let check = (d.children[0].data.hid == d.data.fomular[index][0]) && (d.children[1].data.hid == d.data.fomular[index][1]);
                    $("#fomular-body").append(`
                        <div class="d-flex align-items-center mt-2">
                            <input class="form-check-input mx-2" type="radio" name="fomular" value="${index}" ${check ? "checked": ""}>
                            <img src="${henches[d.data.fomular[index][0]]['icon']}" class="rounded-circle">
                            <span>&nbsp;&nbsp;${translate(henches[d.data.fomular[index][0]]["name"])}&nbsp;+&nbsp;</span>
                            <img src="${henches[d.data.fomular[index][1]]['icon']}" class="rounded-circle">
                            <span>&nbsp;&nbsp;${translate(henches[d.data.fomular[index][1]]["name"])}</span>
                        </div>`);
                }
                $("#fomular-body").append(`
                    <div class="text-center mt-1">
                    <button class="btn btn-secondary btn-sm px-3 py-0" style="font-size: 12px;" onclick="apply_fomular(${d.id})">Apply</button>
                    <button class="btn btn-secondary btn-sm px-3 py-0" style="font-size: 12px;" onclick="apply_fomular(${d.data.hid}, true)">Apply ALL</button>
                    </div>
                `);
            }
        });

    // Transition nodes to their new position.
    const nodeUpdate = node.merge(nodeEnter).transition(transition)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("fill-opacity", 1)
        .attr("stroke-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition(transition).remove()
        .attr("transform", d => `translate(${source.x},${source.y})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0);

    // Update the links…
    const link = gLink.selectAll("path")
        .data(links, d => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link.enter().append("path")
        .attr("class", "link")
        .style("stroke-width", 6)
        .style("stroke", "black")
        .attr("d", d => {
            const o = {
                y: source.x0,
                x: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        });

    // Transition links to their new position.
    link.merge(linkEnter).transition(transition)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition(transition).remove()
        .attr("d", d => {
            const o = {
                y: source.y,
                x: source.x
            };
            return diagonal({
                source: o,
                target: o
            });
        });

    // Stash the old positions for transition.
    root.eachBefore(d => {
        d.y0 = d.x;
        d.x0 = d.y;
    });

    if (resize) {
        setTimeout(() => {
            zoomToFit();
            g.style("display", "");
        }, 200);
    }else{
        g.style("display", "");
    }
    update_statics();
}

function generate_tree(node, traversal) {
    //if (node.name) console.log(node.name, node.fomular_index);
    if (node != undefined && node.fomular != undefined && node.fomular.length > 0) {
        if (node.fomular[node.fomular_index][0] in henches && node.fomular[node.fomular_index][1] in henches) {
            let new_traversal = structuredClone(traversal);
            new_traversal.push(node.hid);

            // loop fomulars
            let fomular_order = [...Array(node.fomular.length).keys()];
            fomular_order.unshift(fomular_order.splice(node.fomular_index, 1)[0]);
            for (let order of fomular_order) {
                if (!traversal.includes(node.fomular[order][0]) && !traversal.includes(node.fomular[order][1])) {
                    node.children = [
                        structuredClone(henches[node.fomular[order][0]]), structuredClone(henches[node.fomular[order][1]])
                    ]

                    if (generate_tree(node.children[0], new_traversal) && generate_tree(node.children[1], new_traversal)) return true;
                }
            }
            return false;
        }
    }
    return true;
}

function zoomToFit(paddingPercent) {
    const bounds = g.node().getBBox();
    const parent = svg.node().parentElement;
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;

    const width = bounds.width;
    const height = bounds.height;

    const midX = bounds.x + (width / 2);
    const midY = bounds.y + (height / 2);

    if (width == 0 || height == 0) return; // nothing to fit

    const scale = (paddingPercent || 0.9) / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

    svg.transition().duration(500).call(zoomBehaviours.transform, transform);
}

function apply_fomular(id, global) {
    let fomular_index = parseInt($("#fomular-body").find("input[name=fomular]:checked").val()) || 0,
        hierarchy_stack = [root],
        henches_stack = [henches[root.data.hid]],
        hierarchy_node = null,
        henches_node = null;

    // find same nodes
    while (hierarchy_stack.length !== 0) {
        hierarchy_node = hierarchy_stack.pop();
        henches_node = henches_stack.pop();

        if (hierarchy_node.children) {
            hierarchy_stack.push(hierarchy_node.children[0]);
            hierarchy_stack.push(hierarchy_node.children[1]);
            henches_stack.push(henches_node.children[0]);
            henches_stack.push(henches_node.children[1]);
        }

        if (global) {
            if (hierarchy_node.data.hid == id) {
                henches_node.fomular_index = fomular_index;
                generate_tree(henches_node, []);
            }
        } else {
            if (hierarchy_node.id == id) {
                henches_node.fomular_index = fomular_index;
                generate_tree(henches_node, []);
                break;
            }
        }
    }

    if (henches_node) {
        // re-generate tree
        tree = d3.tree().nodeSize([dx, dy]);
        root = d3.hierarchy(henches[root.data.hid]);
        // Same first-render NaN-path issue as generate_svg() - see comment there.
        root.x0 = 0;
        root.y0 = 0;
        root.descendants().forEach((d, i) => {
            d.id = i;
            if (d.depth && d.depth > 6) {
                d.children = null;
            }
            d._children = d.children;
        });

        // init svg
        svg.select("g").remove();
        g = svg.append("g").style("display", "none");
        zoomBehaviours = d3.zoom().scaleExtent([0.1, 1]).on("zoom", (ev) => g.attr("transform", ev.transform));
        svg.transition().duration(500).call(zoomBehaviours.transform, d3.zoomIdentity);

        gLink = g.append("g")
            .attr("fill", "none")
            .attr("stroke", "#555")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5);

        gNode = g.append("g")
            .attr("cursor", "pointer")
            .attr("pointer-events", "all");

        update_svg(root, false);
        $("#fomular-panel").addClass("d-none");
    }
}

function update_statics() {
    let statics = get_statics(),
        mix_counter = statics[0],
        hench_counter = statics[1],
        sort_hehch_level = statics[2];

    $("#mixlevel-counter").html(`<span>Hench Count: ${root.leaves().length}</span><br><span>Mix Level (Lv.7 ~ Lv.10): ${mix_counter[0] || 0}/${mix_counter[1] || 0}/${mix_counter[2] || 0}/${mix_counter[3] || 0}</span>`);

    $(".hench-count").html("");
    let id_td = "",
        icon_td = "",
        name_td = "",
        count_td = "";

    for (let index = 0; index < sort_hehch_level.length; index++) {
        id_td = id_td + `<td class="align-middle" scopr="row">${index + 1}</td>`;
        icon_td = icon_td + `<td class="align-middle ${henches[sort_hehch_level[index][0]]["drop_only"] ? 'bg-danger': ''}" scope="row"><img src="${henches[sort_hehch_level[index][0]]["icon"]}" class="p-0" width="50" height="50" alt="${translate(henches[sort_hehch_level[index][0]]["name"])}"></td>`;
        name_td = name_td + `<td class="align-middle px-4" scope="row"><span class="text-nowrap">Lv.${henches[sort_hehch_level[index][0]]["level"]}</span><br><span class="text-nowrap">${translate(henches[sort_hehch_level[index][0]]["name"])}</span></td>`
        count_td = count_td + `<td class="align-middle">${hench_counter[sort_hehch_level[index][0]]}</td>`
    }
    $(".hench-count").append(`
        <thead class="table-dark"><tr><td class="align-middle">#</td>${id_td}</tr></thead>
        <tr><td class="align-middle text-bg-warning">Icon</td>${icon_td}</tr>
        <tr><td class="align-middle text-bg-warning px-3">Name</td>${translate(name_td)}</tr>
        <tr><td class="align-middle text-bg-warning">Count</td>${count_td}</tr>
    `);
}

function export_text(node, prefix) {
    if (node == null || !node.children) return "";
    let left = `${prefix}├─(Lv.${node.children[0]["data"]["level"]}) ${translate(node.children[0]["data"]["name"]).replaceAll("&nbsp;", " ")}`;
    let left_child = export_text(node.children[0], prefix + "|  ");
    let right = `${prefix}└─(Lv.${node.children[1]["data"]["level"]}) ${translate(node.children[1]["data"]["name"]).replaceAll("&nbsp;", " ")}`;
    let right_child = export_text(node.children[1], prefix + "   ");
    return `${left}\n${left_child}${right}\n${right_child ? right_child : prefix + "\n"}`;
}

function get_statics() {
    let stack = [root],
        mix_counter = [],
        hench_counter = {},
        sort_hehch_level = [];

    while (stack.length !== 0) {
        let node = stack.pop();
        if (node.children) {
            stack.push(node.children[0]);
            stack.push(node.children[1]);
            mix_counter[0] = (mix_counter[0] || 0) + (node.data.level >= 121 && node.data.level <= 140);
            mix_counter[1] = (mix_counter[1] || 0) + (node.data.level >= 141 && node.data.level <= 160);
            mix_counter[2] = (mix_counter[2] || 0) + (node.data.level >= 161 && node.data.level <= 180);
            mix_counter[3] = (mix_counter[3] || 0) + (node.data.level >= 181 && node.data.level <= 230);
        } else {
            hench_counter[node.data.hid] = (hench_counter[node.data.hid] || 0) + 1;
        }
    }

    // count hench 
    sort_hehch_level = Object.keys(hench_counter).map(function(hench_id) {
        return [hench_id, henches[hench_id]["level"]];
    });
    sort_hehch_level.sort(function(first, second) {
        return second[1] - first[1];
    });

    return [mix_counter, hench_counter, sort_hehch_level];
}

$(function() {
    init_card();
    load_defs();

    $(".select-type").on("click", function() {
        let type = $(this).data("type");
        $(this).parent().find("div").removeClass("active");
        $(this).addClass("active");
        $(".hench-tab").addClass("d-none");
        $(`#tab${type}`).removeClass("d-none");
    });

    // Mobile hench selector (type dropdown -> name dropdown -> generate_svg),
    // mirrors the desktop type-tab/hench-card flow above for the d-lg-none layout.
    function populateHenchNameSelector(type) {
        let options = Object.values(henches)
            .filter(hench => hench["type"] == type && hench["level"] > 120)
            .sort((a, b) => a["level"] - b["level"])
            .map(hench => `<option value="${hench["hid"]}">Lv.${hench["level"]} ${translate(hench["name"]).replaceAll("&nbsp;", " ")}</option>`)
            .join("");
        $("#henchNameSelector").html(options);
    }

    $("#henchTypeSelector").on("change", function() {
        populateHenchNameSelector($(this).val());
    });

    $("#henchNameSelector").on("change", function() {
        let hid = parseInt($(this).val());
        if (hid) generate_svg(hid);
    });

    populateHenchNameSelector($("#henchTypeSelector").val());

    window.onscroll = function() {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            $("#btn-back-to-top").css("display", "block");
        } else {
            $("#btn-back-to-top").css("display", "none");
        }
    };

    $(".export-text").on("click", function() {
        if (root && root.data.level) {
            let statics = get_statics(),
                mix_counter = statics[0],
                hench_counter = statics[1],
                sort_hehch_level = statics[2],
                content = "";

            content += "=================== Mix Count ===================\n";
            content += `Mix Lv.7: ${mix_counter[0] || 0}, Lv.8: ${mix_counter[1] || 0}, Lv.9: ${mix_counter[2] || 0}, Lv.10: ${mix_counter[3] || 0}\n\n`;
            content += "================== Hench Count ==================\n";
            content += `Hench Count: ${root.leaves().length == 1 ? "0" : root.leaves().length}\n`;
            if (root.leaves().length != 1) {
                for (let index = 0; index < sort_hehch_level.length; index++) {
                    content += `#${index + 1} -> Lv.${henches[sort_hehch_level[index][0]]["level"]}, ${henches[sort_hehch_level[index][0]]["drop_only"] ? "💎" : ""}${translate(henches[sort_hehch_level[index][0]]["name"]).replaceAll("&nbsp;", " ")}: ${hench_counter[sort_hehch_level[index][0]]}\n`;
                }
            }
            content += "\n=================== Mix Tree ====================\n";
            content += `(Lv.${root.data.level})${translate(root.data.name).replaceAll("&nbsp;", " ")}\n${export_text(root, "")}`;

            window.URL = window.URL || window.webkitURL;
            $(".export-text").attr("href", window.URL.createObjectURL(new Blob([content], {
                type: 'text/plain'
            })));
            $(".export-text").attr("download", "MixTree.txt");
        };
    });

    $("#btn-back-to-top").on("click", function() {
        $("html, body").animate({
            scrollTop: 0,
        }, 100);
    });

    $("#close-fomular-panel").on("click", function() {
        $("#fomular-panel").addClass("d-none");
    });

    $("svg").on("click", () => {
        $("#fomular-panel").addClass("d-none");
    });
});

function translate(keyword){
    return keyword;
    dict = {
        "SilverLausta": "變異肥肥",
        "Neo&nbsp;BattleDragon": "超暗人龍",
        "Dragoer": "胖頭龍",
        "NeoSilver": "超變異肥肥",
        "Neo&nbsp;Dragoer": "超胖頭龍",
        "Braki": "粉音樂龍",
        "BlazeRhino": "毒骨龍",
        "Little&nbsp;Snickey": "小綠劍龍",
        "Ancient&nbsp;Draco[1st]": "一代龍球",
        "Seki-Shu-Ryu": "變異胖頭龍",
        "Boardgon": "礦工龍",
        "BlueTail": "藍尾雲龍",
        "Armored": "綠甲殼龍",
        "Ki-Ryu": "深海水妖",
        "Fairudo": "藍龍",
        "Loisy": "路易斯",
        "Evo-Draco": "新龍球",
        "Wypin": "紫斑白龍",
        "Snickey": "劍龍",
        "FireDuke": "長尾陸行鳥",
        "Neo&nbsp;BlueTail": "超藍尾雲龍",
        "DJBraki": "藍音樂龍",
        "FairudoJaune": "黃龍",
        "Drilldra": "綠電鑽龍",
        "Neo&nbsp;Seki-Shu-Ryu": "超變異胖頭龍",
        "Dracoo": "一階新龍",
        "Black&nbsp;Mir": "變異飛天龍",
        "Neo&nbsp;Fairudo": "超藍龍",
        "PuppleQoon": "龍獅",
        "Ancient&nbsp;Draco[2nd]": "二代龍球",
        "InfernoDuke": "超長尾陸行鳥",
        "Punchdra": "紅電鑽龍",
        "Neo&nbsp;Loisy": "超路易斯",
        "Flame&nbsp;Vanyah": "蝙蝠龍",
        "Draccon": "二階新龍",
        "FrozenRhino": "冰毒骨龍",
        "Neo&nbsp;Ki-Ryu": "超深海水妖",
        "Dark&nbsp;Qoon": "暗黑龍師",
        "RFairudo": "紅龍",
        "Dino&nbsp;King": "火山暴龍",
        "Ancient&nbsp;Draco[3rd]": "三代龍球",
        "Draka": "小蒼龍",
        "Serpenka": "小青龍",
        "NeoPunchdra": "超紅鑽頭龍",
        "Snatch": "卡通龍",
        "Spirit&nbsp;of&nbsp;Dra": "日系龍",
        "Blessed&nbsp;Juan": "超黃龍",
        "Blue&nbsp;Garugon": "藍卡魯昆",
        "Blue&nbsp;Armored": "藍甲殼龍",
        "Neo&nbsp;FrozenRhino": "超冰毒骨龍",
        "Red&nbsp;Armored": "紅甲殼龍",
        "Neo&nbsp;Dino&nbsp;King": "超火山龍",
        "Ancient&nbsp;Draco[4th]": "四代龍球",
        "Fairy&nbsp;Dragon": "精靈龍",
        "Golden&nbsp;Duke": "金長尾陸行鳥",
        "Neo&nbsp;BabyDuke": "超長尾陸行鳥寶寶",
        "Neo&nbsp;Snatch": "超卡通龍",
        "Neo&nbsp;Blue&nbsp;Garugon": "超藍卡魯昆",
        "Neo&nbsp;RFairudo": "超紅龍",
        "Neo&nbsp;Spirit&nbsp;of&nbsp;Dra": "超日系龍",
        "Garugon": "卡魯昆",
        "Drakan": "蒼龍",
        "Sei-Ryu": "變種水妖",
        "Di&nbsp;Flower": "火山花龍",
        "Neo&nbsp;Red&nbsp;Armored": "超紅甲殼龍",
        "Serpencan": "青龍",
        "Mutant&nbsp;Snatch": "變種卡龍龍",
        "Neo&nbsp;Golden&nbsp;Duke": "超金長尾陸行鳥",
        "Dino&nbsp;Saur": "綠火山暴龍",
        "Dragnes": "大島龍",
        "Neo&nbsp;Fairy&nbsp;Dragon": "超精靈龍",
        "Draqoon": "紫色龍師",
        "GoldyRhino": "金毒骨龍",
        "Neo&nbsp;Garugon": "超卡魯昆",
        "Rormont": "塔四龍",
        "Neo&nbsp;Sei-Ryu": "超變種水妖",
        "Drakis": "大蒼龍",
        "Neo&nbsp;Rormont": "超塔四龍",
        "Neo&nbsp;Dragnes": "超大島龍",
        "Neo&nbsp;Drakis": "超蒼龍",
        "Ovitor": "牧場龍",
        "Neo&nbsp;Mutant&nbsp;Snatch": "超變種卡通龍",
        "Mutant&nbsp;Rormont": "變種塔四龍",
        "King&nbsp;Mitra": "3D龍",
        "Spirit&nbsp;of&nbsp;Garugon": "染血龍王",
        "Mini&nbsp;KingGarugon": "迷你boss龍",
        "Serpenkis": "神廟龍",
        "Mutant&nbsp;Ryu": "變種水妖",
        "Pirate&nbsp;Drake": "海盜龍",
        "Aperia": "埃及龍",
        "Neo&nbsp;KingMitra": "超3D龍",
        "Neo&nbsp;MiniKGarugon": "超迷你boss龍",
        "Neo&nbsp;Aperia": "超埃及龍",
        "Sinan&nbsp;Arimant": "人型龍",
        "Neo&nbsp;SpiritGarugon": "超染血卡龍王",
        "Neo&nbsp;Serpenkis": "超神廟龍",
        "Neo&nbsp;Sinan&nbsp;Arimant": "超人型龍",
        "Dark&nbsp;King&nbsp;Mir": "暗黑3D龍",
        "Pirate&nbsp;Leviaton": "海盜蛇頸龍",
        "Neo&nbsp;Mu&nbsp;KingG": "超變種卡龍王",

        "Torra": "白虎",
        "Dashabell": "黑狗",
        "Neo&nbsp;Claw": "超運動貓",
        "MintClaw": "變異運動貓",
        "TorraX": "超白虎",
        "Bore": "山豬",
        "BladeDasha": "猛達夏",
        "Wagstuff": "毛怪",
        "Blue&nbsp;Kime": "藍蹦蹦兔",
        "GreenTravel": "翡翠龜",
        "NepheleMan": "雪人獅",
        "EvilClaw": "超變異運動貓",
        "Ancient&nbsp;Beasco[1st]": "一代獸球",
        "Rrainova&nbsp;X": "超雪橇狗",
        "WhiteWags": "白毛",
        "Mint&nbsp;Lion": "雪地獅",
        "Malmon": "象鼻獸",
        "LittleColumbus": "小哥倫布",
        "SnowFoxy": "雪狐",
        "Rhine": "滑輪犀牛",
        "Neo&nbsp;WhiteWags": "超白毛",
        "Wildbore": "黑山豬",
        "Evo-Beasco": "新獸球",
        "Magician": "暴牙兔",
        "Neo&nbsp;GreenTravel": "超翡翠龜",
        "Neo&nbsp;MintLion": "超雪地師",
        "Blue&nbsp;Piggy": "冰棒豬",
        "MalmonFury": "變異象鼻獸",
        "DarkTravel": "暗影龜",
        "Mint&nbsp;LionKing": "雪地獅王",
        "Blue&nbsp;Liddy": "藍水鏡",
        "MilkCow": "奶瓶牛",
        "Bowwow": "河馬獸",
        "Beascoo": "一階新獸",
        "King&nbsp;Piggy": "黃金豬",
        "Columbus": "哥倫布",
        "Jumbo": "珍寶象",
        "SuperCat": "貓獅",
        "Ancient&nbsp;Beasco[2nd]": "二代獸球",
        "KingRhine": "變異犀牛王",
        "OldMagician": "老暴牙兔",
        "Neo&nbsp;Blue&nbsp;Piggy": "超冰棒豬",
        "Neo&nbsp;Fennecus": "超九尾狐",
        "Pongo": "猩猩",
        "Beascoon": "二階新獸",
        "Wind&nbsp;Girl": "風女",
        "Neo&nbsp;Mint&nbsp;LionKing": "超雪地獅王",
        "MadCow": "棒子牛",
        "Leo&nbsp;Khan": "火山獅",
        "LightingMan": "黃金雪人獅",
        "Ancient&nbsp;Beasco[3rd]": "三代獸球",
        "Beaska": "小飛狐",
        "King&nbsp;Mashimaro": "賤兔",
        "King&nbsp;Kambu": "維京兔",
        "Tayka": "小蒼蘭虎",
        "Fire&nbsp;Cat": "火焰貓",
        "CutieCat": "可愛貓",
        "Turtly": "烏龜",
        "PurpleClaw": "紫色運動貓",
        "Raccoon": "熊貓",
        "Monez&nbsp;Queen": "傳豬",
        "Santa&nbsp;YonWolf": "小聖誕狐狸",
        "Dasher": "變異猛達夏",
        "Neo&nbsp;Leo&nbsp;Khan": "超火山獅",
        "Neo&nbsp;MadCow": "超棒子牛",
        "Ancient&nbsp;Beasco[4th]": "四代獸球",
        "SonGok": "孫悟空",
        "Neo&nbsp;BabyDasha": "超黑狗寶寶",
        "Neo&nbsp;BabyWags": "超白毛寶寶",
        "ThunderCat": "閃電貓",
        "Monez&nbsp;King": "傳豬王",
        "Mortar&nbsp;Rabbit": "月兔",
        "Santa&nbsp;Fox": "聖誕狐狸",
        "Neo&nbsp;Raccoon": "超熊貓",
        "Lorelei": "小美人魚",
        "Neo&nbsp;Fire&nbsp;Cat": "超火焰貓",
        "Neo&nbsp;RKPig": "超紅豬王",
        "Neo&nbsp;CutieCat": "超可愛貓",
        "Turtle&nbsp;King": "烏龜王",
        "Beaskan": "飛狐",
        "Purkong": "紫猩猩",
        "NeoSonGok": "超孫悟空",
        "Taykan": "蒼藍虎",
        "Mermaid": "美人魚",
        "Neo&nbsp;Wind&nbsp;Girl": "超風女",
        "ReoTiger": "暗黑火山獅",
        "Golden&nbsp;Monez": "金傳豬",
        "Mutant&nbsp;Raccoon": "變種熊貓",
        "Dream&nbsp;Eater": "小丑皇",
        "Santa&nbsp;Foxier": "超聖誕狐狸",
        "Venom&nbsp;Dasher": "超變異猛達夏",
        "PlazmaCat": "等離子貓",
        "Neo&nbsp;Turtle": "超烏龜",
        "Neo&nbsp;Purkong": "超紫猩猩",
        "Busal": "挑糞河馬",
        "Neo&nbsp;Mermaid": "超美人魚",
        "Cerberus": "塔四獸",
        "Beaskis": "大飛狐",
        "Neo&nbsp;Golden&nbsp;Monez": "超金傳豬",
        "Hell&nbsp;Eater": "地獄小丑皇",
        "Neo&nbsp;Cerberus": "超塔四獸",
        "Neo&nbsp;PlazmaCat": "超等離子貓",
        "Neo&nbsp;Beaskis": "超飛狐",
        "Neo&nbsp;ShadowClaw": "暗黑3D貓",
        "Samaelle": "牧場獸",
        "Neo&nbsp;Mutant&nbsp;Raccoon": "超變種熊貓",
        "Mutant&nbsp;Cerberus": "變種塔四獸",
        "King&nbsp;Mintclaw": "3D獸",
        "Mini&nbsp;Hellfard": "迷你boss獸",
        "Taykis": "神廟獸",
        "Pirate&nbsp;Deck": "海盜獸",
        "(R)&nbsp;Turtly": "變種烏龜",
        "Zacharis": "埃及獸",
        "Wild&nbsp;Tooth": "海盜鯊魚",
        "Neo&nbsp;KingMintclaw": "超3D獸",
        "Neo&nbsp;MiniHellfard": "超迷你Boss獸",
        "Neo&nbsp;Zacaris": "超埃及獸",
        "Sinan&nbsp;Lexy": "人型獸",
        "Neo&nbsp;Wallaby": "超拳擊袋鼠",
        "(R)&nbsp;Turtlegle": "變種烏龜王",
        "Neo&nbsp;Taykis": "超神廟獸",
        "Neo&nbsp;Sinan&nbsp;Lexy": "超人型獸",
        "Neo&nbsp;Mu&nbsp;Hellf": "超變種獸王",

        "BeetlePete": "瓦斯蛋",
        "Neo&nbsp;Cabbager": "超花苞蟲",
        "Neo&nbsp;Bolarish": "超玩具蜂",
        "KingDusty": "黃翼蜂",
        "Neo&nbsp;NTV": "超大頭蒼蠅",
        "BloodStinger": "毒針王峰",
        "Neo&nbsp;HornKing": "超變異領路甲蟲",
        "KillerPete": "超瓦斯蛋",
        "Neo&nbsp;HornQueen": "超領路甲蟲",
        "PunchLava": "拳擊蟲",
        "Neo&nbsp;Stinger": "超毒針王峰",
        "HandBomb": "榴砲蟲",
        "Bamudar": "蜘蛛",
        "New&nbsp;Delcoy": "超蝸牛叮噹",
        "Ancient&nbsp;Inseco[1st]": "一代蟲球",
        "Siper": "生化賽普",
        "Neo&nbsp;KingDusty": "超黃翼蜂",
        "DevilDusty": "變異黃翼蜂",
        "Beetleger": "甲蟲士兵",
        "Hornz": "大角蟲",
        "Blue&nbsp;Baccho": "藍色巴丘",
        "Ziller": "藍天魔狼蛛",
        "Evo-Inseco": "新蟲球",
        "DeadlyBamude": "超蜘蛛",
        "CloneBeetle": "甲蟲戰士",
        "Neo&nbsp;Blue&nbsp;Baccho": "超藍色巴丘",
        "Poisoner": "毒蜘蛛",
        "Siperous": "超生化賽普",
        "KillerZill": "超藍天魔狼蛛",
        "GauntletBomb": "頭盔榴砲蟲",
        "Insecoo": "一階新蟲",
        "QueenSting": "大角飛蠅",
        "BeetleClass": "太空甲蟲",
        "Dark&nbsp;Hornz": "暗黑大角蟲",
        "Ancient&nbsp;Inseco[2nd]": "二代蟲球",
        "AlertSpider": "警戒蜘蛛",
        "Scorpasis": "藍蠍將軍",
        "ChampLava": "拳王蟲",
        "Neo&nbsp;GauntletBomb": "超頭盔榴砲蟲",
        "Insecoon": "二階新蟲",
        "Joker": "小丑蜘蛛",
        "MegaHornz": "巨型大角蟲",
        "BeetleKnight": "光劍甲蟲",
        "Ancient&nbsp;Inseco[3rd]": "三代蟲球",
        "Insecka": "小冰蠍",
        "Storm&nbsp;Jedi": "絕地甲蟲",
        "Beetleka": "穿山甲",
        "Neo&nbsp;BeetleClass": "超太空甲蟲",
        "NeoQueen": "超大角飛蠅",
        "Lucanus": "金龜蟲",
        "ColorfulSpider": "花蜘蛛",
        "StrongScorp": "超藍蠍將軍",
        "NeoJoker": "超小丑蜘蛛",
        "Ancient&nbsp;Inseco[4th]": "四代蟲球",
        "LittleCrab": "小粉蟹",
        "Nipper&nbsp;King": "鐵鉗將軍",
        "Neo&nbsp;Lucanus": "超金龜蟲",
        "Neo&nbsp;MegaHornz": "超巨型大角蟲",
        "AlburyChamp": "超拳王蟲",
        "Inseckan": "冰蠍",
        "SpirdeZ": "變異藍天魔狼蛛",
        "Neo&nbsp;Storm&nbsp;Jedi": "超絕地甲蟲",
        "ScorpQueen": "蠍子后",
        "Beetlekan": "超蹦蛙",
        "Mutant&nbsp;Luccanus": "變種金龜蟲",
        "KingJoker": "小丑蜘蛛王",
        "Titanice": "大島蝴蝶",
        "Crab&nbsp;King": "螃蟹王",
        "ScorpKing": "蠍子王",
        "Inferno&nbsp;Queen": "變異大角飛蠅",
        "Neo&nbsp;Nipper&nbsp;King": "超鐵鉗將軍",
        "Hotaru": "塔四蟲",
        "Neo&nbsp;Titanice": "超大島蝴蝶",
        "Neo&nbsp;Crab&nbsp;King": "超螃蟹王",
        "Inseckis": "大冰蠍",
        "Neo&nbsp;Hotaru": "超塔四蟲",
        "Neo&nbsp;ScorpKing": "超蠍王",
        "Neo&nbsp;Inseckis": "超冰蠍",
        "Lava&nbsp;Crab": "牧場蟲",
        "Neo&nbsp;Mutant&nbsp;Lucanus": "超變種金龜蟲",
        "Mutant&nbsp;Hotaru": "變種塔四蟲",
        "King&nbsp;Bamudar": "3D蜘蛛",
        "Spirit&nbsp;of&nbsp;NipperKing": "染血鐵鉗",
        "Mini&nbsp;CutterMantis": "迷你boss蟲",
        "Beetlekis": "神廟蟲",
        "Pirate&nbsp;Cracke": "海盜蟲",
        "Drill&nbsp;Hornet": "埃及蟲",
        "Neo&nbsp;KingBamudar": "超3D蜘蛛",
        "Neo&nbsp;MiniCutter": "超迷你boss蟲",
        "Neo&nbsp;Drill&nbsp;Hornet": "超埃及蟲",
        "Sinan&nbsp;Rosa": "人型蟲",
        "Neo&nbsp;SpiritNipperKing": "超染血鐵鉗",
        "Neo&nbsp;Beetlekis": "超神廟蟲",
        "Neo&nbsp;Sinan&nbsp;Rosa": "超人型蟲",
        "Dark&nbsp;King&nbsp;Bamu": "暗黑3D蟲",
        "Pirate&nbsp;TuTu": "海盜蟲",
        "Neo&nbsp;Mu&nbsp;Cutter": "超變種蟲王",

        "Neo&nbsp;AncientKilla": "超司芬克斯",
        "Soulbreaker": "伊夫萊克",
        "Ayaya": "呀呀鳥",
        "NeoSoul": "伊夫萊克",
        "NeoGamerika": "超卡梅拉克",
        "Neo&nbsp;Soulbreaker": "超蘇夫萊克",
        "CrimsonMetal": "雙斧鎧魔",
        "BomberGun": "大鼻鳥",
        "Ancient&nbsp;Metaco[1st]": "機械一代球",
        "Neo&nbsp;Ayaya": "超呀呀鳥",
        "LampNSocket": "燈泡機器人",
        "Dark&nbsp;Breaker": "暗黑蘇夫萊克",
        "TheUnknown": "大眼藍",
        "Shield": "盾牌機器人",
        "GunSmash": "小鋼",
        "MiniVulcan": "微型坦克車",
        "Evo-Metaco": "新機械球",
        "Spiker": "雙輪機械車",
        "Neo&nbsp;Dark&nbsp;Breaker": "超暗黑蘇夫萊克",
        "PlugNSocket": "按鈕機器人",
        "SignalNeon": "信號機器人",
        "BomberGunMk2": "超大鼻鳥",
        "Metacoo": "一階新機械",
        "Silver&nbsp;Kun": "銀月庫恩",
        "Neo&nbsp;GunSmash": "超小鋼",
        "TweesToonga": "紅齒輪",
        "Infamous": "灰信號機器人",
        "Speenity": "機械牛庫恩",
        "Ancient&nbsp;Metaco[2nd]": "二代機械球",
        "Bluemetal": "藍雙斧鎧魔",
        "NeoVulcan": "超坦克車",
        "Neo&nbsp;Silver&nbsp;Kun": "超銀月庫恩",
        "Spiker&nbsp;X": "超雙輪機械車",
        "BomberGunX": "紅小鋼",
        "Neo&nbsp;Ostrich": "機械鴕鳥",
        "Metacoon": "二階新機械",
        "Old&nbsp;Metal": "灰雙斧鎧魔",
        "Unk&nbsp;Green": "大眼綠",
        "DarkToonga": "暗黑齒輪",
        "Young&nbsp;Spirit": "日系機械",
        "UltraSoul": "機械犀牛",
        "Blacknity": "灰機械牛庫恩",
        "Ancient&nbsp;Metaco[3rd]": "機械三代球",
        "Metaka": "小火焰機器人",
        "Machineka": "小飛機",
        "VulcanX": "VulcanX",
        "Mono&nbsp;Red&nbsp;Eye": "紫莫諾阿伊",
        "BomberGunY": "超紅小鋼",
        "Metal&nbsp;Tiger": "機械老虎",
        "MixDestroyer": "坦克",
        "Green&nbsp;Metal": "綠雙斧鎧魔",
        "UnkRed": "大眼紅",
        "NeoUltraSoul": "超機械犀牛",
        "Neo&nbsp;Toonga": "超齒輪",
        "Rolling&nbsp;Stone": "滾石機器人",
        "Ancient&nbsp;Metaco[4th]": "機械四代球",
        "Mono&nbsp;Y&nbsp;Eye": "超黃莫諾阿伊",
        "Unk&nbsp;Yellow": "大眼黃",
        "Coppernity": "紅機械犀牛",
        "Neo&nbsp;Metal&nbsp;Tiger": "超機械老虎",
        "Big&nbsp;Ancient": "大司芬克斯",
        "Flint": "紫鋼",
        "Neo&nbsp;oldenMa": "超盾牌機器人",
        "Neo&nbsp;MuGamerika": "超變種卡梅拉克",
        "Neo&nbsp;MixDestroyer": "超坦克",
        "Metakan": "火焰機器人",
        "Neo&nbsp;Young&nbsp;Spirit": "超日系機械",
        "Neo&nbsp;Blacknity": "超灰機械犀牛",
        "Yellow&nbsp;Metal": "黃雙斧鎧魔",
        "EvilToonga": "嗜血齒輪",
        "Machinekan": "機械齒輪",
        "SparkSoul": "冰機械犀牛",
        "Old&nbsp;Ancient": "法老司芬克斯",
        "Old&nbsp;Unknown": "大眼灰",
        "Mutant&nbsp;Metal&nbsp;Tiger": "變種機械老虎",
        "Neo&nbsp;Flint": "超紫鋼",
        "Pink&nbsp;MixDestroyer": "粉坦克",
        "Guarder": "護盾機器人",
        "Neo&nbsp;Mono&nbsp;Y&nbsp;Eye": "超黃莫諾阿伊",
        "Neo&nbsp;Coppernity": "超紅機械犀牛",
        "PurpleMetal": "紫雙斧鎧魔",
        "Neo&nbsp;Rolling": "超滾石機器人",
        "Balrog": "塔四機械",
        "Killer&nbsp;Machine": "殺手伊夫萊克",
        "Metakis": "大火焰機器人",
        "Neo&nbsp;Balrog": "超塔四機械",
        "Neo&nbsp;Old&nbsp;Metal": "超灰雙斧鎧魔",
        "Neo&nbsp;Metakis": "超火焰機器人",
        "Mine&nbsp;Cart": "牧場機械",
        "Neo&nbsp;Mutant&nbsp;Tiger": "超變種機械老虎",
        "Mutant&nbsp;Balrog": "變種塔四",
        "King&nbsp;Gunsmash": "3D小鋼",
        "Mini&nbsp;Destroyer": "迷你boss機械",
        "Machinekis": "神廟機械",
        "Pirate&nbsp;Metabit": "海盜機械",
        "Sake&nbsp;Musa": "埃及機械",
        "Neo&nbsp;KingGunsmash": "超3D小鋼",
        "Neo&nbsp;MiniDestroyer": "超迷你boss機械",
        "Neo&nbsp;SakeMusa": "超埃及機械",
        "Sinan&nbsp;Balian": "人型機械",
        "Neo&nbsp;Machinekis": "超神廟機械",
        "Neo&nbsp;Sinan&nbsp;Balian": "超人型機械",
        "Mutant&nbsp;Gun": "變種大鼻鳥",
        "Pirate&nbsp;Angleo": "海盜炸彈魔",
        "Neo&nbsp;Mu&nbsp;Destr": "超變種機械王",

        "InsaneDoctor": "超達特凱彬",
        "Neo&nbsp;AquaPing": "超變異大眼",
        "Stoner": "石奴",
        "Neo&nbsp;Ukki": "超護衛",
        "Gokuma": "酷瑪",
        "Neo&nbsp;Chowie": "超亙馬利奧",
        "Snogyun": "史諾基",
        "Goldener": "金石奴",
        "KingRookPawn": "紅桃木偶",
        "Neo&nbsp;NortsNcross": "超斑馬蟲",
        "HellCrown": "地獄皇冠",
        "Button": "按鈕",
        "Ancient&nbsp;Mysco[1st]": "神秘一代球",
        "MacT-Bone": "紅眼釘錘怪",
        "BoxingTower": "拳擊塔",
        "Neo&nbsp;Bangie": "超綠幽靈",
        "Neo&nbsp;Gokuma": "超酷瑪",
        "Hatti": "哈蒂",
        "Binocchio": "詭異木偶",
        "Neo&nbsp;Snogyun": "超史諾基",
        "Evo-Mysco": "新神秘球",
        "Mr.Rupert": "小壞",
        "Purple&nbsp;Button": "紫按鈕",
        "SnowBall": "雪球",
        "Neo&nbsp;HellCrown": "超地獄皇冠",
        "TopDrum": "頂鼓",
        "Psycho&nbsp;Wags": "紅色毛怪",
        "Giant": "巨人",
        "SwordTower": "劍塔",
        "SirRupert": "超小壞",
        "Myscoo": "一階新神秘",
        "Bomberfarm": "Bomberfarm",
        "XT-Bone": "超紅眼釘錘怪",
        "Neo&nbsp;Binocchio": "超詭異木偶",
        "Blood&nbsp;Shadow": "嗜血魔術師",
        "BigHead": "大頭",
        "Ancient&nbsp;Mysco[2nd]": "神秘二代球",
        "Mintmal": "冥特魔",
        "Neo&nbsp;Mintmall": "超冥特魔",
        "SandBall": "沙球",
        "Neo&nbsp;SnowBall": "超雪球",
        "ShadowMagic": "變異魔術師",
        "Myscoon": "二階新神秘",
        "Persoz": "滾球小丑",
        "TopCymbals": "變異打鼓機",
        "Titan": "泰坦",
        "Neo&nbsp;BigHead": "超大頭",
        "Tears": "眼淚",
        "Ancient&nbsp;Mysco[3rd]": "神秘三代球",
        "Myska": "小波賽頓",
        "Old&nbsp;Spirit": "日系神秘",
        "Magicka": "小魔術師",
        "Neo&nbsp;SandBall": "超沙球",
        "ArmIris": "巨眼魔",
        "Neo&nbsp;ShadowMagic": "超變異魔術師",
        "New&nbsp;Persoz": "新滾球小丑",
        "Gothicmall": "變種冥特魔",
        "Ancient&nbsp;Mysco[4th]": "神秘四代球",
        "Neo&nbsp;Tears": "超眼淚",
        "Neo&nbsp;BabyStoner": "超石奴寶寶",
        "New&nbsp;ArmIris": "超巨眼魔",
        "Magic": "瑪奇",
        "Neo&nbsp;Old&nbsp;Spirit": "超日系神秘",
        "Neo&nbsp;MutantMact": "超變種釘錘怪",
        "Neo&nbsp;TopCymbals": "超變異打鼓機",
        "Soul&nbsp;Eater": "嗜魂",
        "Myskan": "波賽頓",
        "Mad&nbsp;BigHead": "粉大頭",
        "HotPot": "火鍋大廚",
        "Neo&nbsp;Gothicmall": "超變種冥特魔",
        "Mutant&nbsp;Tears": "變種眼淚",
        "Magickan": "魔術師",
        "CrazyMacT": "嗜血釘錘怪",
        "Super&nbsp;Magic": "超瑪奇",
        "Dark&nbsp;Iris": "暗黑巨眼魔",
        "Neo&nbsp;Blood&nbsp;Shadow": "超嗜血魔術師",
        "Neo&nbsp;Mad&nbsp;BigHead": "超粉大頭",
        "Neo&nbsp;HotPot": "超大廚",
        "Mecha&nbsp;HotPod": "變種大廚",
        "Neo&nbsp;Soul&nbsp;Eater": "超嗜魂",
        "Jester": "塔四神秘",
        "Ultra&nbsp;Magic": "究極瑪奇",
        "Myskis": "大波賽頓",
        "Neo&nbsp;Jester": "超塔四神秘",
        "Neo&nbsp;CrazyMacT": "超嗜血釘錘怪",
        "Neo&nbsp;Myskis": "超波賽頓",
        "Tiger&nbsp;Moss": "牧場神秘",
        "Neo&nbsp;Mutant&nbsp;Tears": "超變種眼淚",
        "Mutant&nbsp;Jester": "變種塔四神秘",
        "King&nbsp;MacT-Bone": "3D神秘",
        "Spirit&nbsp;of&nbsp;SoulEater": "染血嗜魂",
        "Mini&nbsp;RoofTileGeneral": "迷你boss神秘",
        "Magickis": "神廟神秘",
        "Pirate&nbsp;Akupone": "海盜神秘",
        "Atlas": "埃及神秘",
        "Neo&nbsp;KingMacT-Bone": "超3D神秘",
        "Neo&nbsp;MiniGeneral": "超迷你boss神秘",
        "Neo&nbsp;Atlas": "超埃及神秘",
        "Sinan&nbsp;Estela": "人型神秘",
        "Neo&nbsp;SpiritSoulEater": "超染血嗜魂",
        "Neo&nbsp;Magickis": "超神廟神秘",
        "Neo&nbsp;Sinan&nbsp;Estela": "超人型神秘",
        "King&nbsp;Snog": "3D史諾基",
        "Neo&nbsp;Mu&nbsp;General": "超變種神秘王",

        "Amazonez": "假面鬼",
        "Pumped": "萬聖惡魔",
        "Tomated": "布熱迪連特",
        "PumpedCurse": "超萬聖惡魔",
        "Kugutu": "巨靈惡魔",
        "Marogniex": "超小鬼",
        "Blackened": "巨影惡魔",
        "NeoWildBuma": "超變異邦迪",
        "Neo&nbsp;Wiesha": "超暗惡靈",
        "PhantomWing": "小惡魔",
        "Neo&nbsp;Tomated": "超布熱迪連特",
        "Ordevil": "風琴惡魔",
        "Succubus": "魅魔",
        "Cursed&nbsp;Phantom": "超小惡魔",
        "DevilStone": "變異小惡魔",
        "Ancient&nbsp;Devilco[1st]": "惡魔一代球",
        "Dark&nbsp;Tomated": "暗黑萬聖惡魔",
        "PBanshee": "紫女僕",
        "HellBoy": "地獄男孩",
        "Maleki": "美樂奇",
        "Honmaleki": "變異美樂奇",
        "NeoOrdevil": "超風琴惡魔",
        "BattleAmazonez": "變異假面鬼",
        "Tomahawk": "斧頭怪",
        "Neo&nbsp;Devil&nbsp;Stone": "超變異小惡魔",
        "Failbizu": "光頭惡魔",
        "Evo-Devilco": "新惡魔球",
        "HellBlack": "超巨影惡魔",
        "Saruff": "沙魯法",
        "BDevil&nbsp;Wing": "藍變異小惡魔",
        "FrankenNo1": "弗蘭肯一號",
        "Neo&nbsp;DarkTomated": "超暗黑萬聖惡魔",
        "Onestep": "雙錘戰士",
        "RBanshee": "紅女僕",
        "Banshee": "藍女僕",
        "Stonefist": "石頭怪",
        "FrankenNo2": "弗蘭肯二號",
        "Devilcoo": "一階新惡魔",
        "BoneQoomtra": "惡魔骨龍",
        "Neo&nbsp;Saruff": "超沙魯法",
        "GateToDeath": "死神",
        "FrankenNo3": "芙蘭肯三號",
        "Ancient&nbsp;Devilco[2nd]": "惡魔二代球",
        "Pumpkin": "南瓜",
        "Neo&nbsp;R&nbsp;Banshee": "超紅女僕",
        "Neo&nbsp;PBanshee": "超紫女僕",
        "Devilcoon": "二階新惡魔",
        "Neo&nbsp;Pumpkin": "超南瓜",
        "Neo&nbsp;Banshee": "超藍女僕",
        "Blue&nbsp;Saruff": "變異沙魯法",
        "PDevil&nbsp;Wing": "紫小惡魔",
        "Dalsipper": "魔王",
        "Qoomtra": "變異惡魔骨龍",
        "Avenger": "復仇者",
        "YBanshee": "黃女僕",
        "Ninja&nbsp;Girl": "女忍者",
        "Ancient&nbsp;Devilco[3rd]": "惡魔三代球",
        "Devika": "小蝙蝠惡魔",
        "Evilka": "小地獄使者",
        "Lai&nbsp;Spirit": "日系惡魔",
        "Sky&nbsp;Banshee": "天藍女僕",
        "Cursed&nbsp;Gate": "超死神",
        "Snake": "眼鏡蛇",
        "Herriben": "巨拳惡靈",
        "Brown&nbsp;DWing": "黃色小惡魔",
        "Pumpkin&nbsp;Girl": "南瓜女",
        "BloodQoomtra": "嗜血骨龍",
        "Ancient&nbsp;Devilco[4th]": "惡魔四代球",
        "Mirror&nbsp;ball": "麥克風",
        "Neo&nbsp;BabyKugutu": "超巨靈惡魔寶寶",
        "Neo&nbsp;Blue&nbsp;Saruff": "超藍沙魯法",
        "Neo&nbsp;Qoomtra": "超惡魔骨龍",
        "GateToHell": "灰死神",
        "Snake&nbsp;King": "眼鏡蛇王",
        "Neo&nbsp;MuOrdevil": "超變種風琴惡魔",
        "Neo&nbsp;Herriben": "超巨拳惡靈",
        "Devikan": "蝙蝠惡魔",
        "Neo&nbsp;Pumpkin&nbsp;Girl": "超南瓜女",
        "Y&nbsp;Dalsipper": "黃魔王",
        "Neo&nbsp;Lai&nbsp;Spirit": "超日系惡魔",
        "Neo&nbsp;Ninja&nbsp;Girl": "超女忍者",
        "IceDevil": "冰鬼",
        "Evilkan": "地獄使者",
        "Hina&nbsp;doll": "安娜貝爾",
        "Mutant&nbsp;Herriben": "變種巨拳惡魔",
        "Neo&nbsp;Kin&nbsp;Banshee": "超3D女僕",
        "SilverDall": "變異魔王",
        "Cursed&nbsp;Jack": "詛咒南瓜",
        "Neo&nbsp;GateToHell": "超灰死神",
        "NeoSnakeKing": "超眼鏡蛇王",
        "Neo&nbsp;Mirrow": "超麥克風",
        "Pump&nbsp;King": "南瓜王",
        "Evil&nbsp;Agipara": "嗜血鬼面人",
        "Lucifer": "塔四惡魔",
        "Sabato": "超變異骨龍",
        "Pump&nbsp;Princess": "南瓜女王",
        "Pump&nbsp;Lantern": "南瓜燈籠",
        "Devilkis": "大蝙蝠惡魔",
        "Neo&nbsp;Lucifer": "超塔四惡魔",
        "Neo&nbsp;SilverDall": "超變異魔王",
        "Neo&nbsp;Devilkis": "超蝙蝠惡魔",
        "Queen&nbsp;Banshee": "3D女僕王",
        "Lava&nbsp;Giant": "牧場惡魔",
        "Neo&nbsp;CursedJack": "超詛咒南瓜",
        "Neo&nbsp;Mutant&nbsp;Herriben": "超變種巨拳惡靈",
        "Jack&nbsp;O-lantern&nbsp;D": "南瓜燈籠王",
        "Mutant&nbsp;Lucifer": "變種塔四惡魔",
        "King&nbsp;Oredevil": "3D惡魔",
        "Mutant&nbsp;Kugutu": "變種巨靈惡魔",
        "Mini&nbsp;Anubis": "迷你boss惡魔",
        "Evilkis": "神廟惡魔",
        "Admiral": "海盜惡魔",
        "Hellhound": "地獄犬",
        "Neo&nbsp;KingOrdevil": "超3D惡魔",
        "Neo&nbsp;MiniAnubis": "超迷你boss惡魔",
        "Neo&nbsp;Helhound": "超地獄犬",
        "Sinan&nbsp;Beres": "人型惡魔",
        "Neo&nbsp;Jalasar": "超海盜船長",
        "Neo&nbsp;Evilkis": "超神廟惡魔",
        "Neo&nbsp;Sinan&nbsp;Beres": "超人型惡魔",
        "Spirit&nbsp;of&nbsp;Gate": "染血死神",
        "Neo&nbsp;Mu&nbsp;Anubis": "超變種惡魔王",

        "Phoenix": "變異大紅鷹",
        "Pink&nbsp;Flyer": "變異杰弗德",
        "MadTailor": "米德特爾",
        "WingCrusher": "翁克萊斯",
        "WingStormer": "風特斯",
        "Red&nbsp;Balloon": "紅氣球鳥",
        "Neo&nbsp;Synicks": "超紅嘴豚",
        "Jone": "水手鳥A",
        "RockyRush": "聖誕企鵝",
        "Sage": "紫火山鳥",
        "Ancient&nbsp;Birdco[1st]": "鳥一代球",
        "FireBird": "火鳥",
        "NeoMad": "超米德特爾",
        "Snow&nbsp;Rush": "變異聖誕企鵝",
        "Neo&nbsp;Thunderbird": "超大紅鷹",
        "Yellow&nbsp;Balloon": "黃氣球鳥",
        "Harpy": "哈比鳥",
        "Neo&nbsp;RockyRush": "超聖誕企鵝",
        "WingThunder": "超風特斯",
        "SoldierHawk": "老鷹士兵",
        "Evo-Birdco": "新鳥球",
        "Jack": "水手鳥B",
        "Griffin": "獅鷲獸",
        "Blue&nbsp;Balloon": "藍氣球鳥",
        "Orange&nbsp;Balloon": "橘氣球鳥",
        "Dark&nbsp;Crusher": "暗黑翁克萊斯",
        "ChickenFighter": "戰鬥雞",
        "Blue&nbsp;Harpy": "變異哈比鳥",
        "PurpleBalloon": "紫氣球鳥",
        "Pioki": "捲尾巴",
        "Birdcoo": "一階新鳥",
        "PelocanDuo": "水手鳥兄弟",
        "Green&nbsp;Balloon": "綠氣球鳥",
        "Neo&nbsp;BlueHarpy": "超變異哈比鳥",
        "Neo&nbsp;Griffin": "超獅鷲獸",
        "Persona": "紳士鳥",
        "GladyHawk": "老鷹戰士",
        "Ancient&nbsp;Birdco[2nd]": "鳥二代球",
        "Chuck": "海盜鵜鶘鳥",
        "Neo&nbsp;Dark&nbsp;Harpy": "超暗黑哈比鳥",
        "Cupid": "天使",
        "Neo&nbsp;Strigidae": "超貓頭鷹",
        "Birdcoon": "二階新鳥",
        "Duck&nbsp;Fire": "火雞",
        "PelicanCrew": "3P鳥",
        "Pioking": "超捲尾巴",
        "Dark&nbsp;Pitt": "惡魔鳥",
        "KalinAngel": "森之女王",
        "Neo&nbsp;Persona": "超紳士鳥",
        "Scho&nbsp;Spirit": "日系鳥",
        "Gold&nbsp;Hawk": "火山鳥",
        "Ancient&nbsp;Birdco[3rd]": "三代鳥球",
        "Birdka": "小蒼藍鳥",
        "Croka": "小烏骨雞",
        "Devigle": "禿鷹",
        "PersonaSoul": "變異紳士鳥",
        "Lobby": "愛心鳥",
        "Neo&nbsp;Cupid": "超天使",
        "Neo&nbsp;Dark&nbsp;Pitt": "超惡魔鳥",
        "Neo&nbsp;Gold&nbsp;Hawk": "超火山鳥",
        "Ancient&nbsp;Birdco[4th]": "四代鳥球",
        "Gryps": "變異獅鷲獸",
        "Neo&nbsp;GladyHawk": "超老鷹戰士",
        "Neo&nbsp;Devigle": "超禿鷹",
        "Neo&nbsp;KalinAngel": "超森女",
        "RedPersona": "火紅紳士鳥",
        "Birdkan": "蒼藍鳥",
        "Neo&nbsp;PelicanCrew": "超級3p鳥",
        "Grace": "變種米德特爾",
        "Brave&nbsp;Duck": "變異火雞",
        "Neo&nbsp;Lobby": "超愛心鳥",
        "Neo&nbsp;Scho&nbsp;Spirit": "超日系鳥",
        "Blue&nbsp;Bird": "冰晶鳥",
        "Crokan": "烏骨雞",
        "NeoGryps": "超變異獅鷲獸",
        "Evil&nbsp;Hawk": "變異火山鳥",
        "ThunderHawk": "閃電鳥戰士",
        "Mutant&nbsp;Devigle": "變種禿鷹",
        "Winged&nbsp;Harpy": "藍鳥",
        "Piocker": "變異捲尾巴",
        "New&nbsp;Grace": "超變種米德特爾",
        "Neo&nbsp;Braver": "超變異火雞",
        "FlamePersona": "烈焰紳士鳥",
        "Venus&nbsp;Angel": "藍森女",
        "Neo&nbsp;Blue&nbsp;Bird": "超冰晶鳥",
        "Vortexer": "變異風特斯",
        "Michael": "塔四鳥",
        "Birdkis": "大蒼藍鳥",
        "Mini&nbsp;Venus": "迷你森女",
        "Neo&nbsp;Michael": "超塔四鳥",
        "Neo&nbsp;Vortexer": "超變異風特斯",
        "Neo&nbsp;Birdkis": "超級",
        "Neo&nbsp;Winged&nbsp;Harpy": "超蒼藍鳥",
        "Cockatrice": "牧場鳥",
        "Neo&nbsp;Mutant&nbsp;Devigle": "超變種禿鷹",
        "Mutant&nbsp;Michael": "變種塔四鳥",
        "King&nbsp;Harpy": "3D鳥",
        "Mini&nbsp;Phoenix": "迷你boss鳥",
        "Crokis": "神廟鳥",
        "Pirate&nbsp;Jack": "海盜鳥",
        "Horus": "埃及鳥",
        "Neo&nbsp;KingHarpy": "超3D鳥",
        "Neo&nbsp;MiniPhoenix": "超迷你boss鳥",
        "Neo&nbsp;Horus": "超埃及鳥",
        "Sinan&nbsp;Pelic": "人型鳥",
        "Neo&nbsp;Crokis": "超神廟鳥",
        "Neo&nbsp;Sinan&nbsp;Pelic": "超人型鳥",
        "Pirate&nbsp;Crash": "海盜哈比鳥",
        "Neo&nbsp;Mu&nbsp;Phoenix": "超變種鳥王",

        "Tenkaki": "木偶人",
        "Chikaki": "木牌怪",
        "Ballza": "斯凱波",
        "Neo&nbsp;Hornmameo": "超頑皮球",
        "Mimi": "咪咪",
        "Neo&nbsp;Yassie": "超耶誕樹",
        "MantyPlant": "特工螳螂",
        "Neo&nbsp;TimTona": "超托納西",
        "Shin-Chikaki": "超木牌怪",
        "Neo&nbsp;Cactusing": "超節節高",
        "Cabit": "小綠狗",
        "Teddy": "泰迪",
        "Clover": "變異刺花",
        "Neo&nbsp;MantyPlant": "超特工螳螂",
        "Ancient&nbsp;Flowco[1st]": "植物一代球",
        "WildBallza": "超斯凱波",
        "MerryBongBong": "瑪麗蹦蹦",
        "Dark&nbsp;Mameo": "暗黑頑皮球",
        "SunFlower": "太陽花",
        "Palm&nbsp;Boy": "菜頭",
        "Nauren": "木樁怪",
        "Evo-Flowco": "新植物球",
        "Mutant&nbsp;Douda": "變種大嘴怪",
        "Neo&nbsp;Chikaki": "超級木偶人",
        "Elder": "樹妖長老",
        "Neo&nbsp;Palmboy": "超級菜頭",
        "PetitChikaki": "花木牌怪",
        "Eldering": "千年樹妖",
        "Dusty&nbsp;Elder": "暗黑樹妖",
        "Flowcoo": "一階新植物",
        "Neo&nbsp;Mutant": "超級大嘴怪",
        "PetitTenkaki": "花木偶人",
        "Neo&nbsp;SunFlower": "超級太陽花",
        "Ancient&nbsp;Flowco[2nd]": "植物二代球",
        "RedLeaf": "紅葉",
        "BallzaC": "變異斯凱波",
        "Elder&nbsp;X": "超樹妖長老",
        "Flowcoon": "二階新植物",
        "SunFlame": "焰陽花",
        "Neo&nbsp;Nauren": "超木樁怪",
        "TinkerBell": "蜜蜂樹妖",
        "MadOrchid": "大眼樹妖",
        "Double&nbsp;Mameo": "火焰頑皮球",
        "Neo&nbsp;PetitChikaki": "超花木牌怪",
        "Garlingz": "巨臂樹精",
        "WildBallzaC": "超變異斯凱波",
        "Ancient&nbsp;Flowco[3rd]": "植物三代球",
        "Flowka": "小沙漠奈雅",
        "Vezika": "小翠綠龍",
        "Moon&nbsp;Flower": "月光花",
        "Nymph": "檳榔",
        "Neo&nbsp;PetitTenkaki": "超花木偶人",
        "Neo&nbsp;TinkerBell": "超蜜蜂樹妖",
        "Neo&nbsp;RedLeaf": "超紅葉",
        "DeadlyManty": "嗜血螳螂",
        "Ancient&nbsp;Flowco[4th]": "植物四代球",
        "Neo&nbsp;Moon": "超月光花",
        "Neo&nbsp;Garlingz": "超巨臂樹精",
        "Fire&nbsp;Tinkerbell": "火焰蜜蜂樹妖",
        "Neo&nbsp;Nymph": "超級檳榔",
        "Neo&nbsp;MadOrchid": "超級大眼花妖",
        "PurpleLeaf": "紫葉",
        "Neo&nbsp;SunFlame": "超級焰陽花",
        "Flowkan": "沙漠奈雅",
        "Yggdrasil": "變種樹妖",
        "Neo&nbsp;Double&nbsp;Mameo": "超火焰頑皮球",
        "Blue&nbsp;Garlingz": "藍巨臂樹精",
        "Vezikan": "翠綠龍",
        "Flame&nbsp;Tinkerbell": "烈焰蜜蜂樹妖",
        "Mutant&nbsp;Nymph": "變種檳榔",
        "Arbor&nbsp;Vitae": "金木樁怪",
        "Neo&nbsp;PurpleLeaf": "超紫葉",
        "Doom&nbsp;Flower": "末日花",
        "Dark&nbsp;Orchid": "暗黑大眼花妖",
        "Neo&nbsp;Yggdrasil": "超變種樹妖",
        "Viroza": "塔四植物",
        "Qliphoth": "超藍巨臂樹精",
        "Providence": "超變種樹妖",
        "Flowkis": "神木戰士",
        "Neo&nbsp;Viroza": "超塔四植物",
        "Neo&nbsp;Doom&nbsp;Flower": "超末日花",
        "Neo&nbsp;Flowkis": "超神木戰士",
        "Big&nbsp;Stomp": "牧場植物",
        "Neo&nbsp;Mutant&nbsp;Nymph": "超變種檳榔",
        "Mutant&nbsp;Viroza": "變種塔四植物",
        "Mutant&nbsp;Elder": "變種樹妖長老",
        "King&nbsp;Balzar": "3D植物",
        "Mini&nbsp;Nepenthes": "迷你boss植物",
        "Vezikis": "神廟植物",
        "Pirate&nbsp;Harpa": "海盜章魚",
        "Genie": "埃及植物",
        "Blood&nbsp;Surgery": "海盜船",
        "Neo&nbsp;KingBalzar": "超3D植物",
        "Neo&nbsp;MiniNepenthes": "超迷你boss植物",
        "Neo&nbsp;Geni": "超埃及植物",
        "Sinan&nbsp;Chlora": "人型植物",
        "Neo&nbsp;Vezikis": "超神廟植物",
        "Neo&nbsp;Sinan&nbsp;Chlora": "超人型植物",
        "Mutant&nbsp;Flower": "變種太陽花",
        "Neo&nbsp;Mu&nbsp;Nephen" : "超變種植物王"
    };

    return dict[keyword] || keyword;
}
