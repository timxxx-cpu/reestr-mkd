package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "common_areas")
public class CommonAreaEntity extends BaseEntity {

    @Column(name = "floor_id", nullable = false)
    private String floorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", insertable = false, updatable = false)
    private FloorEntity floor;

    @Column(name = "entrance_id")
    private String entranceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entrance_id", insertable = false, updatable = false)
    private EntranceEntity entrance;

    @Column(name = "type")
    private String type;

    @Column(name = "area")
    private BigDecimal area;

    @Column(name = "height")
    private BigDecimal height;
}
